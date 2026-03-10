module.exports = [
"[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/src/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/src/components/search/SearchResults.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SearchResults
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
;
;
function SearchResults({ query, results }) {
    if (!results.length) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            children: [
                'No records found for "',
                query,
                '".'
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/search/SearchResults.tsx",
            lineNumber: 11,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
        style: {
            listStyle: "none",
            display: "grid",
            gap: "0.75rem",
            padding: 0
        },
        children: results.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                style: {
                    border: "1px solid #ddd",
                    padding: "1rem"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                            children: row.address
                        }, void 0, false, {
                            fileName: "[project]/src/components/search/SearchResults.tsx",
                            lineNumber: 19,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/search/SearchResults.tsx",
                        lineNumber: 18,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            row.city,
                            ", ",
                            row.state,
                            " ",
                            row.zip
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/search/SearchResults.tsx",
                        lineNumber: 21,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "PIN: ",
                            row.pin
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/search/SearchResults.tsx",
                        lineNumber: 24,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "Owner: ",
                            row.ownerName
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/search/SearchResults.tsx",
                        lineNumber: 25,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        href: `/address/${row.pin}`,
                        children: "Open property details"
                    }, void 0, false, {
                        fileName: "[project]/src/components/search/SearchResults.tsx",
                        lineNumber: 26,
                        columnNumber: 11
                    }, this)
                ]
            }, row.pin, true, {
                fileName: "[project]/src/components/search/SearchResults.tsx",
                lineNumber: 17,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/search/SearchResults.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/mvpData.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SAMPLE_ADDRESSES",
    ()=>SAMPLE_ADDRESSES,
    "getAddressByPinFallback",
    ()=>getAddressByPinFallback,
    "getPortfolioByIdFallback",
    ()=>getPortfolioByIdFallback,
    "getPortfolioSummaryFallback",
    ()=>getPortfolioSummaryFallback,
    "searchAddressesFallback",
    ()=>searchAddressesFallback
]);
const SAMPLE_ADDRESSES = [
    {
        pin: "17062010120000",
        address: "1234 W Division St",
        city: "Chicago",
        state: "IL",
        zip: "60642",
        ownerName: "Division Property Group LLC",
        portfolioId: "pf-division-group",
        violationsOpen: 3,
        permitsTotal: 5
    },
    {
        pin: "17062010130000",
        address: "1238 W Division St",
        city: "Chicago",
        state: "IL",
        zip: "60642",
        ownerName: "Division Property Group LLC",
        portfolioId: "pf-division-group",
        violationsOpen: 1,
        permitsTotal: 2
    },
    {
        pin: "17071090050000",
        address: "4500 N Sheridan Rd",
        city: "Chicago",
        state: "IL",
        zip: "60640",
        ownerName: "Sheridan Portfolio Holdings",
        portfolioId: "pf-sheridan-holdings",
        violationsOpen: 7,
        permitsTotal: 8
    }
];
function searchAddressesFallback(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SAMPLE_ADDRESSES.filter((row)=>{
        return row.address.toLowerCase().includes(q) || row.pin.includes(q) || row.ownerName.toLowerCase().includes(q);
    });
}
function getAddressByPinFallback(pin) {
    return SAMPLE_ADDRESSES.find((row)=>row.pin === pin) ?? null;
}
function getPortfolioByIdFallback(portfolioId) {
    return SAMPLE_ADDRESSES.filter((row)=>row.portfolioId === portfolioId);
}
function getPortfolioSummaryFallback(portfolioId) {
    const rows = getPortfolioByIdFallback(portfolioId);
    if (!rows.length) {
        return null;
    }
    return {
        portfolioId,
        ownerName: rows[0].ownerName,
        pinCount: rows.length,
        totalViolationsOpen: rows.reduce((acc, row)=>acc + row.violationsOpen, 0),
        totalPermits: rows.reduce((acc, row)=>acc + row.permitsTotal, 0)
    };
}
}),
"[project]/src/lib/dataSource.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DataSourceUnavailableError",
    ()=>DataSourceUnavailableError,
    "getAddressByPin",
    ()=>getAddressByPin,
    "getPortfolioById",
    ()=>getPortfolioById,
    "getPortfolioSummary",
    ()=>getPortfolioSummary,
    "searchAddresses",
    ()=>searchAddresses
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$browser$2f$index$2d$node$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/convex/dist/esm/browser/index-node.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$browser$2f$http_client$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/convex/dist/esm/browser/http_client.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$server$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/convex/dist/esm/server/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$server$2f$api$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/convex/dist/esm/server/api.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/mvpData.ts [app-rsc] (ecmascript)");
;
;
;
const addressesSearchRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$server$2f$api$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeFunctionReference"])("addresses:search");
const addressByPinRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$server$2f$api$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeFunctionReference"])("addresses:getByPin");
const portfolioByIdRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$server$2f$api$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeFunctionReference"])("portfolios:getById");
const portfolioSummaryRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$server$2f$api$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeFunctionReference"])("portfolios:getSummary");
class DataSourceUnavailableError extends Error {
    constructor(message){
        super(message);
        this.name = "DataSourceUnavailableError";
    }
}
function getConvexUrl() {
    return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
}
function isSampleDataAllowed() {
    return process.env.WOW_ALLOW_SAMPLE_DATA === "1";
}
function getServerClient() {
    const convexUrl = getConvexUrl();
    if (!convexUrl) return null;
    const client = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$convex$2f$dist$2f$esm$2f$browser$2f$http_client$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ConvexHttpClient"](convexUrl);
    return client;
}
async function searchAddresses(query) {
    const client = getServerClient();
    if (!client) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["searchAddressesFallback"])(query);
        }
        throw new DataSourceUnavailableError("Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.");
    }
    try {
        return await client.query(addressesSearchRef, {
            query
        });
    } catch (error) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["searchAddressesFallback"])(query);
        }
        throw new DataSourceUnavailableError(`Failed to query Convex for address search: ${String(error)}`);
    }
}
async function getAddressByPin(pin) {
    const client = getServerClient();
    if (!client) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAddressByPinFallback"])(pin);
        }
        throw new DataSourceUnavailableError("Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.");
    }
    try {
        const row = await client.query(addressByPinRef, {
            pin
        });
        return row ?? null;
    } catch (error) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAddressByPinFallback"])(pin);
        }
        throw new DataSourceUnavailableError(`Failed to query Convex for address lookup: ${String(error)}`);
    }
}
async function getPortfolioById(portfolioId) {
    const client = getServerClient();
    if (!client) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPortfolioByIdFallback"])(portfolioId);
        }
        throw new DataSourceUnavailableError("Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.");
    }
    try {
        return await client.query(portfolioByIdRef, {
            portfolioId
        });
    } catch (error) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPortfolioByIdFallback"])(portfolioId);
        }
        throw new DataSourceUnavailableError(`Failed to query Convex for portfolio rows: ${String(error)}`);
    }
}
async function getPortfolioSummary(portfolioId) {
    const client = getServerClient();
    if (!client) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPortfolioSummaryFallback"])(portfolioId);
        }
        throw new DataSourceUnavailableError("Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL.");
    }
    try {
        const row = await client.query(portfolioSummaryRef, {
            portfolioId
        });
        if (!row && isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPortfolioSummaryFallback"])(portfolioId);
        }
        return row;
    } catch (error) {
        if (isSampleDataAllowed()) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$mvpData$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPortfolioSummaryFallback"])(portfolioId);
        }
        throw new DataSourceUnavailableError(`Failed to query Convex for portfolio summary: ${String(error)}`);
    }
}
}),
"[project]/src/app/search/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SearchPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$search$2f$SearchResults$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/search/SearchResults.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$dataSource$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/dataSource.ts [app-rsc] (ecmascript)");
;
;
;
async function SearchPage({ searchParams }) {
    const params = await searchParams;
    const query = (params.q ?? "").trim();
    let results = [];
    let dataError = "";
    try {
        results = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$dataSource$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["searchAddresses"])(query);
    } catch (error) {
        if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$dataSource$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DataSourceUnavailableError"]) {
            dataError = error.message;
        } else {
            throw error;
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        style: {
            padding: "2rem",
            display: "grid",
            gap: "1rem"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Search Results"
            }, void 0, false, {
                fileName: "[project]/src/app/search/page.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            dataError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: dataError
            }, void 0, false, {
                fileName: "[project]/src/app/search/page.tsx",
                lineNumber: 28,
                columnNumber: 20
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$search$2f$SearchResults$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                query: query,
                results: results
            }, void 0, false, {
                fileName: "[project]/src/app/search/page.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/search/page.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/app/search/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/search/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b6921982._.js.map