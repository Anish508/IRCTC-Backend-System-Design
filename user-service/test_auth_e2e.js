import redis from "./src/lib/redis.js";

const BASE_URL = "http://localhost:5001/api/v1/auth";
const ALT_BASE_URL = "http://localhost:5001/api/auth";

// Helper to parse Set-Cookie headers
function parseCookies(response) {
    const rawCookies = response.headers.getSetCookie
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie") || ""];

    const cookies = {};
    for (const raw of rawCookies) {
        if (!raw) continue;
        const parts = raw.split(";")[0].split("=");
        if (parts.length >= 2) {
            cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
        }
    }
    return cookies;
}

function buildCookieHeader(cookies) {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  PASS: ${message}`);
        passed++;
    } else {
        console.error(`  FAIL: ${message}`);
        failed++;
    }
}

async function clearRateLimitKeys() {
    const keys = await redis.keys("auth:ratelimit:*");
    if (keys && keys.length > 0) {
        await redis.del(...keys);
    }
}

async function runTests() {
    console.log("==================================================");
    console.log("   RUNNING PRODUCTION AUTHENTICATION TEST SUITE   ");
    console.log("==================================================");

    await clearRateLimitKeys();

    // TEST 1: Generic failure on non-existent email
    console.log("\n[TEST 1] Login with non-existent email");
    {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "nonexistent.user.12345@irctc.co.in",
                password: "Password123!"
            })
        });
        const data = await res.json();
        assert(res.status === 401, `Status is 401 (got ${res.status})`);
        assert(data.message === "Invalid email or password.", `Generic message (got "${data.message}")`);
    }

    // TEST 2: Generic failure on wrong password
    console.log("\n[TEST 2] Login with wrong password");
    {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test.auth@irctc.co.in",
                password: "WrongPassword999!"
            })
        });
        const data = await res.json();
        assert(res.status === 401, `Status is 401 (got ${res.status})`);
        assert(data.message === "Invalid email or password.", `Generic message (got "${data.message}")`);
    }

    // TEST 3: Successful login
    console.log("\n[TEST 3] Successful login with valid credentials");
    let cookies = {};
    let initialUser = null;
    {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test.auth@irctc.co.in",
                password: "Password123!"
            })
        });
        const data = await res.json();
        cookies = parseCookies(res);

        assert(res.status === 200, `Status is 200 (got ${res.status})`);
        assert(data.success === true, "Response success is true");
        assert(!!cookies.access_token, "Received HttpOnly access_token cookie");
        assert(!!cookies.refresh_token, "Received HttpOnly refresh_token cookie");
        assert(data.data.user.email === "test.auth@irctc.co.in", "User email matched");
        assert(data.data.user.password === undefined, "Password is NOT in response");
        assert(data.data.user.passwordHash === undefined, "Password hash is NOT in response");
        initialUser = data.data.user;
    }

    // TEST 4: Protected route with access token cookie
    console.log("\n[TEST 4] Protected route GET /me with valid access token cookie");
    {
        const res = await fetch(`${BASE_URL}/me`, {
            method: "GET",
            headers: {
                Cookie: buildCookieHeader(cookies)
            }
        });
        const data = await res.json();
        assert(res.status === 200, `Status is 200 (got ${res.status})`);
        assert(data.data.user.id === initialUser.id, "Authenticated user ID matches");
        assert(data.data.user.password === undefined, "No password exposed");
    }

    // TEST 5: Protected route without access token
    console.log("\n[TEST 5] Protected route GET /me without token");
    {
        const res = await fetch(`${BASE_URL}/me`, {
            method: "GET"
        });
        const data = await res.json();
        assert(res.status === 401, `Status is 401 (got ${res.status})`);
        assert(data.success === false, "Access denied");
    }

    // TEST 6: Refresh token rotation
    console.log("\n[TEST 6] Refresh token rotation POST /refresh");
    const oldRefreshToken = cookies.refresh_token;
    let newCookies = {};
    {
        const res = await fetch(`${BASE_URL}/refresh`, {
            method: "POST",
            headers: {
                Cookie: buildCookieHeader(cookies)
            }
        });
        const data = await res.json();
        newCookies = parseCookies(res);

        assert(res.status === 200, `Status is 200 (got ${res.status})`);
        assert(data.success === true, "Refresh succeeded");
        assert(!!newCookies.access_token, "Received new access_token cookie");
        assert(!!newCookies.refresh_token, "Received new refresh_token cookie");
        assert(newCookies.refresh_token !== oldRefreshToken, "Refresh token was rotated (new != old)");
    }

    // TEST 7: New access token works on protected route
    console.log("\n[TEST 7] Protected route with new rotated access token");
    {
        const res = await fetch(`${BASE_URL}/me`, {
            method: "GET",
            headers: {
                Cookie: buildCookieHeader(newCookies)
            }
        });
        const data = await res.json();
        assert(res.status === 200, `Status is 200 (got ${res.status})`);
        assert(data.data.user.id === initialUser.id, "User authenticated with rotated token");
    }

    // TEST 8: Refresh Token Reuse Detection
    console.log("\n[TEST 8] Refresh Token Reuse Detection (Presenting already-rotated Token)");
    {
        // Present the old, already rotated refresh token!
        const res = await fetch(`${BASE_URL}/refresh`, {
            method: "POST",
            headers: {
                Cookie: `refresh_token=${oldRefreshToken}`
            }
        });
        const data = await res.json();
        assert(res.status === 401, `Status is 401 Unauthorized (got ${res.status})`);
        assert(data.success === false, "Reused token was rejected");

        // Verify that the whole family/session was revoked:
        // Even the new token should now be invalidated!
        const subsequentRes = await fetch(`${BASE_URL}/refresh`, {
            method: "POST",
            headers: {
                Cookie: `refresh_token=${newCookies.refresh_token}`
            }
        });
        assert(subsequentRes.status === 401, "Subsequent refresh with family token also rejected (Family Revoked)");
    }

    // Clear rate limits before concurrency test
    await clearRateLimitKeys();

    // TEST 9: Race Condition Concurrency Protection
    console.log("\n[TEST 9] Concurrent refresh race condition test");
    {
        // Login fresh to get a new session
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test.auth@irctc.co.in",
                password: "Password123!"
            })
        });
        const freshCookies = parseCookies(loginRes);

        // Send two simultaneous refresh requests with the EXACT SAME refresh token
        const [res1, res2] = await Promise.all([
            fetch(`${BASE_URL}/refresh`, {
                method: "POST",
                headers: { Cookie: buildCookieHeader(freshCookies) }
            }),
            fetch(`${BASE_URL}/refresh`, {
                method: "POST",
                headers: { Cookie: buildCookieHeader(freshCookies) }
            })
        ]);

        const statuses = [res1.status, res2.status];
        const successCount = statuses.filter(s => s === 200).length;
        console.log(`  Statuses: Request 1: ${res1.status}, Request 2: ${res2.status}`);

        assert(successCount <= 1, `Only at most ONE concurrent request succeeded in rotating (got ${successCount})`);
        assert(statuses.includes(200) || statuses.includes(429), "Concurrency lock prevented double rotation");
    }

    // TEST 10: Logout and cookie clearing
    console.log("\n[TEST 10] Logout flow POST /logout");
    {
        // Login fresh
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test.auth@irctc.co.in",
                password: "Password123!"
            })
        });
        const logoutTestCookies = parseCookies(loginRes);

        // Call logout
        const logoutRes = await fetch(`${BASE_URL}/logout`, {
            method: "POST",
            headers: { Cookie: buildCookieHeader(logoutTestCookies) }
        });
        const logoutData = await logoutRes.json();
        const clearedCookies = parseCookies(logoutRes);

        assert(logoutRes.status === 200, `Logout status is 200 (got ${logoutRes.status})`);
        assert(logoutData.success === true, "Logout success is true");
        assert(clearedCookies.access_token === "", "access_token cookie cleared");
        assert(clearedCookies.refresh_token === "", "refresh_token cookie cleared");

        // Subsequent /refresh should fail
        const postLogoutRefresh = await fetch(`${BASE_URL}/refresh`, {
            method: "POST",
            headers: { Cookie: buildCookieHeader(logoutTestCookies) }
        });
        assert(postLogoutRefresh.status === 401, "Post-logout refresh fails with 401");
    }

    await clearRateLimitKeys();

    // TEST 11: Alternative route mounting (/api/auth vs /api/v1/auth)
    console.log("\n[TEST 11] Alternative route mounting /api/auth/login and /api/auth/me");
    {
        const loginRes = await fetch(`${ALT_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test.auth@irctc.co.in",
                password: "Password123!"
            })
        });
        const altCookies = parseCookies(loginRes);
        assert(loginRes.status === 200, `/api/auth/login returned 200`);

        const meRes = await fetch(`${ALT_BASE_URL}/me`, {
            headers: { Cookie: buildCookieHeader(altCookies) }
        });
        assert(meRes.status === 200, `/api/auth/me returned 200 with cookies`);
    }

    // TEST 12: Rate limiting verification
    console.log("\n[TEST 12] Rate Limiting enforcement (POST /login)");
    {
        await clearRateLimitKeys();
        // Send 11 rapid requests (limit is 10)
        let rateLimitedResponse = null;
        for (let i = 0; i < 11; i++) {
            const res = await fetch(`${BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "test.auth@irctc.co.in",
                    password: "Password123!"
                })
            });
            if (res.status === 429) {
                rateLimitedResponse = res;
                break;
            }
        }
        assert(!!rateLimitedResponse, "Encountered 429 Too Many Requests after exceeding threshold");
        if (rateLimitedResponse) {
            const data = await rateLimitedResponse.json();
            assert(rateLimitedResponse.status === 429, `Status is 429 (got ${rateLimitedResponse.status})`);
            assert(!!rateLimitedResponse.headers.get("retry-after"), "Retry-After header present");
            assert(data.message.includes("Too many"), `Rate limit message received: "${data.message}"`);
        }
    }

    await clearRateLimitKeys();

    console.log("\n==================================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    await redis.quit();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("Test execution error:", err);
    process.exit(1);
});
