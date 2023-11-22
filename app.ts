import express from "express";
import cookieSession from "cookie-session";
import {
    getSessionFromStorage,
    getSessionIdFromStorageAll,
    Session,
} from "@inrupt/solid-client-authn-node";
import { config } from "dotenv";
import * as fs from "fs";
import * as https from "https";
import { AuthorizationAgent } from "./src/authorization-agent";
import { ApplicationRegistrationNotExist } from "./src/application-registration-not-exist";
import { getPodUrlAll } from "@inrupt/solid-client";
import { SocialAgentProfileDocument } from "./src/profile-documents/social-agent-profile-document";
import { authorizationAgentUrl2webId, webId2AuthorizationAgentUrl } from "./src/utils/uri-convert";
import { AccessApprovalHandler } from "./src/handlers/AccessApprovalHandler";
import { ApplicationRegistration } from "solid-interoperability/src/data-management/data-model/agent-registration/application-registration"
import { ApplicationAgent, SocialAgent } from "solid-interoperability";
import { insertTurtleResource, readResource } from "./src/utils/modify-pod";
import { serializeTurtle } from "./src/utils/turtle-serializer";
import { ApplicationProfileDocument } from "./src/profile-documents/application-profile-document";
import { DataAccessScope, DataAccessScopeAll } from "./src/application/data-access-scope";
import { AccessNeedGroup } from "./src/application/access-need-group";
import Link from "http-link-header";
import { parseTurtle } from "./src/utils/turtle-parser";
import path from "path";
import { RedisSolidStorage } from "./src/redis/redis-storage";

config();
const app = express();
export const port = parseInt(process.env.PORT || "3000");
export const address = process.env.ADDRESS || "localhost";
const hostname = "0.0.0.0";
const useHttps = process.env?.HTTPS == "TRUE";
export const protocol = `http${useHttps ? "s" : ""}://`;
const private_key = process.env.PRIVATEKEY ?? "";
const certificate = process.env.CERTIFICATE ?? "";

const oidcIssuers = ["https://login.inrupt.com", "https://solidweb.me", "https://solidcommunity.net"]

type WebId = string;
const cache = new Map<WebId, AuthorizationAgent>();
// The following snippet ensures that the server identifies each user's session
// with a cookie using an express-specific mechanism
app.use(
    cookieSession({
        name: "session",
        // These keys are required by cookie-session to sign the cookies.
        keys: [
            "Required, but value not relevant for this demo - key1",
            "Required, but value not relevant for this demo - key2",
        ],
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }),
);

// app.get("/login", async (req, res) => {
//     // 1. Create a new Session
//     const session = new Session();
//     req.session!.sessionId = session.info.sessionId;
//     const redirectToSolidIdentityProvider = (url: string) => {
//         // Since we use Express in this example, we can call `res.redirect` to send the user to the
//         // given URL, but the specific method of redirection depend on your app's particular setup.
//         // For example, if you are writing a command line app, this might simply display a prompt for
//         // the user to visit the given URL in their browser.
//         res.redirect(url);
//     };
//     // 2. Start the login process; redirect handler will handle sending the user to their
//     //    Solid Identity Provider.
//     await session.login({
//         // After login, the Solid Identity Provider will send the user back to the following
//         // URL, with the data necessary to complete the authentication process
//         // appended as query parameters:
//         redirectUrl: `${protocol}${address}:${port}/login/callback`,
//         // Set to the user's Solid Identity Provider; e.g., "https://login.inrupt.com"
//         oidcIssuer: oidcIssuers[2],
//         // Pick an application name that will be shown when asked
//         // to approve the application's access to the requested data.
//         clientName: "Authorization Agent",
//         handleRedirect: redirectToSolidIdentityProvider,
//     });
// });

// app.get("/login/callback", async (req, res) => {
//     // 3. If the user is sent back to the `redirectUrl` provided in step 2,
//     //    it means that the login has been initiated and can be completed. In
//     //    particular, initiating the login stores the session in storage,
//     //    which means it can be retrieved as follows.
//     const session = await getSessionFromStorage(req.session!.sessionId);

//     // 4. With your session back from storage, you are now able to
//     //    complete the login process using the data appended to it as queryª
//     //    parameters in req.url by the Solid Identity Provider:
//     await session!.handleIncomingRedirect(
//         `${req.protocol}://${req.get("host")}${req.originalUrl}`,
//     );

//     // 5. `session` now contains an authenticated Session instance.
//     const webId = session!.info.webId!
//     if (session!.info.isLoggedIn) {
//         return res.send(`<p>Logged in with the WebID ${webId}.</p>`);
//     }
// });

// // 6. Once you are logged in, you can retrieve the session from storage,
// //    and perform authenticated fetches.
// app.get("/fetch", async (req, res) => {
//     if (typeof req.query["resource"] === "undefined") {
//         res.send(
//             "<p>Please pass the (encoded) URL of the Resource you want to fetch using `?resource=&lt;resource URL&gt;`.</p>",
//         );
//     }
//     const session = await getSessionFromStorage(req.session!.sessionId);
//     const f = req.query["resource"];
//     console.log(await (await session!.fetch(<string>f)).text());
//     res.send("<p>Performed authenticated fetch.</p>");
// });

// // 7. To log out a session, just retrieve the session from storage, and
// //    call the .logout method.
// app.get("/logout", async (req, res) => {
//     const session = await getSessionFromStorage(req.session!.sessionId);
//     session!.logout();
//     res.send(`<p>Logged out.</p>`);
// });

// // 8. On the server side, you can also list all registered sessions using the
// //    getSessionIdFromStorageAll function.
// app.get("/", async (req, res) => {
//     const sessionIds = await getSessionIdFromStorageAll();
//     for (const a in sessionIds) {
//         // Do something with the session ID...
//     }
//     res.send(`<p>There are currently [${sessionIds.length}] visitors.</p>`);
// });

if (useHttps) {
    const options = {
        key: fs.readFileSync(private_key),
        cert: fs.readFileSync(certificate),
    };

    const server = https.createServer(options, app);

    server.listen(port, hostname, () => {
        console.log(`Server running at https://${hostname}:${port}/`);
    });
} else {
    app.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
}

// const a = `@prefix foaf: <http://xmlns.com/foaf/0.1/>.
// @prefix solid: <http://www.w3.org/ns/solid/terms#>.

// <>
//     a foaf:PersonalProfileDocument;
//     foaf:maker <http://localhost:3000/bob-pod/profile/card#me>;
//     foaf:primaryTopic <http://localhost:3000/bob-pod/profile/card#me>.

// <http://localhost:3000/bob-pod/profile/card#me>

//     solid:oidcIssuer <http://localhost:3000/>;
//     a foaf:Person.`

// async function f() {
//     const prefixes = {
//         foaf: 'http://xmlns.com/foaf/0.1/',
//         solid: 'http://www.w3.org/ns/solid/terms#',
//       };
// console.log(await serializeTurtle(await parseTurtle(a, "http://localhost:3000/bob-pod/profile/card#me"), prefixes))
// }
// f()

const authorization_router = express.Router()
app.use('/agents', authorization_router);

authorization_router.get("/new", async (req, res) => {
    // 1. Create a new Session
    const session = new Session({ storage: new RedisSolidStorage() });
    req.session!.sessionId = session.info.sessionId;
    const redirectToSolidIdentityProvider = (url: string) => {
        // Since we use Express in this example, we can call `res.redirect` to send the user to the
        // given URL, but the specific method of redirection depend on your app's particular setup.
        // For example, if you are writing a command line app, this might simply display a prompt for
        // the user to visit the given URL in their browser.
        res.redirect(url);
    };
    // 2. Start the login process; redirect handler will handle sending the user to their
    //    Solid Identity Provider.
    await session.login({
        // After login, the Solid Identity Provider will send the user back to the following
        // URL, with the data necessary to complete the authentication process
        // appended as query parameters:
        redirectUrl: `${protocol}${address}:${port}/agents/new/callback`,
        // Set to the user's Solid Identity Provider; e.g., "https://login.inrupt.com"
        oidcIssuer: oidcIssuers[2],
        // Pick an application name that will be shown when asked
        // to approve the application's access to the requested data.
        clientName: "Authorization Agent",
        handleRedirect: redirectToSolidIdentityProvider,
    });
    // return turtle document with the redirecct endpoints
})

async function getAlreadyAuthorizationAgents() {
    await getSessionIdFromStorageAll(new RedisSolidStorage())
        .then(async sessionIds => {
            for (const id of sessionIds) {
                const session = await getSessionFromStorage(id, new RedisSolidStorage())
                if (!session) {
                    continue;
                }
                const webId = session.info.webId!
                const agent_URI = webId2AuthorizationAgentUrl(webId)
                const pods = await getPodUrlAll(webId, { fetch: session!.fetch })
                console.log(webId)
                console.log(pods[0])
                console.log(session.info)
                cache.set(webId, new AuthorizationAgent(new SocialAgent(webId), new ApplicationAgent(agent_URI), pods[0], session))
                cache.get(webId)!.setRegistriesSetContainer()
            }
        })
}

async function removePrevoiusSession(webId: string, expectSessionId: string) {
    await getSessionIdFromStorageAll(new RedisSolidStorage())
        .then(async sessionIds => {
            for (const id of sessionIds) {
                if (id == expectSessionId) {
                    continue;
                }
                const session = await getSessionFromStorage(id, new RedisSolidStorage())
                if (!session) {
                    continue;
                }
                if (session.info.webId! == webId) {
                    session.logout()
                }
            }
        })
}

authorization_router.get("/new/callback", async (req, res) => {
    // 3. If the user is sent back to the `redirectUrl` provided in step 2,
    //    it means that the login has been initiated and can be completed. In
    //    particular, initiating the login stores the session in storage,
    //    which means it can be retrieved as follows.
    const session = await getSessionFromStorage(req.session!.sessionId, new RedisSolidStorage());


    if (!session) {
        return res.sendStatus(403).send()
    }

    // 4. With your session back from storage, you are now able to
    //    complete the login process using the data appended to it as query
    //    parameters in req.url by the Solid Identity Provider:
    await session.handleIncomingRedirect(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    )

    // 5. `session` now contains an authenticated Session instance.
    const webId = session.info.webId!
    removePrevoiusSession(webId, req.session!.sessionId)
    const authAgent = cache.get(webId)
    if (authAgent) {
        authAgent.session = session
    }
    else {
        const agent_URI = webId2AuthorizationAgentUrl(webId)
        const profile_document: SocialAgentProfileDocument = await SocialAgentProfileDocument.getProfileDocument(webId)

        if (!(profile_document.hasAuthorizationAgent(agent_URI))) {
            profile_document.addhasAuthorizationAgent(agent_URI)
        }

        const pods = await getPodUrlAll(webId, { fetch: session!.fetch })
        cache.set(webId, new AuthorizationAgent(new SocialAgent(webId), new ApplicationAgent(agent_URI), pods[0], session))
        cache.get(webId)!.setRegistriesSetContainer()
    }


    if (session!.info.isLoggedIn) {
        return res.send(`<p>Logged in with the WebID ${webId}. <a herf="localhost:3001/agents/new"></p>`);
    }
});


/*
The endpoint for requesting if a Application have access to the Pod.
Returns the agent registration of the requesting application agent as JSON
*/
authorization_router.head("/:webId", async (req, res) => {
    const authorization_agent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    const client_id: string = req.query.client_id as string
    try {
        const registration: ApplicationRegistration = await authorization_agent.findAgentRegistration(client_id) as ApplicationRegistration
        res.status(200).send(JSON.stringify(registration));
    } catch (error) {
        res.status(400).send("No registration found for this WebId: " + req.params.webId);
    }
})

// async function a(){
//     const s = fs.readFileSync("test/projectron.ttl", "utf-8")
//     const client_id = "https://projectron.example/#id"
//     const p = await parseTurtle(s, client_id)
//     return new ApplicationProfileDocument(client_id, p.dataset, p.prefixes)
// }


/*
The endpoint for the Application wanting access to a Pod
*/
authorization_router.post("/:webId/wants-access", async (req, res, next) => {
    const authorization_agent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    const accessApprovalHandler = new AccessApprovalHandler();

    const client_id: string = req.query.client_id as string;

    const approved: boolean = accessApprovalHandler.requestAccessApproval();

    const fetch = authorization_agent.session.fetch;

    if (approved) {
        ApplicationProfileDocument.getRdfDocument(client_id, fetch)
            .then(applicationProfileDocument => applicationProfileDocument.gethasAccessNeedGroup(fetch))
            .then(needGroups => {
                const access = new Map<AccessNeedGroup, DataAccessScope[]>();
                needGroups.forEach(group => {
                    group.then(group => {
                        group.getHasAccessNeed(fetch)
                            .then(needs => access.set(group, needs.map(accessNeed => new DataAccessScopeAll(accessNeed))))
                    })
                })
                return access
            })
            .then(access => authorization_agent.newApplication(accessApprovalHandler.getApprovalStatus(new ApplicationAgent(client_id), access)))
            .then(_ => res.status(202).send())
            .catch(err => res.sendStatus(500));
    }
    else {
        res.status(403).send('Your request got rejected');
    }
})

authorization_router.get("/:webId/redirect", async (req, res) => {
    throw new Error('Not implemented yet');
})




const pods_router = express.Router()
app.use('/pods', pods_router);

/*
Endpoint for inserting data into the Pod
*/
pods_router.put("/:dataId/:webId", async (req, res) => {
    const dataId: string = req.params.dataId;
    const authorization: string = req.headers["Authorization"] as string;
    const link: string = req.headers["Link"] as string;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);

    if (!authorization || !link) {
        return res.status(400).json({ error: "Both Authorization and Link headers are required." });
    }

    if (!authorizationAgent) {
        return res.status(401).json({ error: "Invalid or expired authorization agent." });
    }

    try {
        const linkValue = Link.parse(link);

        if (linkValue.refs.length === 1) {
            const dataInstanceIRI: string = linkValue.refs[0].uri + '/' + dataId;
            insertTurtleResource(authorizationAgent.session, dataInstanceIRI, req.body);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: "Only one Link header is allowed." });
        }
    } catch (error) {
        console.error("Error processing the request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/*
Endpoint for getting data from the Pod
*/
pods_router.get("/:dataIRI/:webId", async (req, res) => {
    const dataIRI: string = req.params.dataIRI;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);
    readResource(authorizationAgent!.session, dataIRI).then((data) => {
        res.status(200).send(data);
    }).catch((error) => {
        res.status(500).json({ error: "Internal Server Error" });
    });
})



const projectron_router = express.Router()
app.use('/projectron', projectron_router);

projectron_router.get("/", async (req, res) => {
    const options = {
        root: path.join(__dirname, "../")
    };
    return res.status(200).sendFile("test/projectron.ttl", options);
})

export { app };

getAlreadyAuthorizationAgents()