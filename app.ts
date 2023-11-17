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
import { ApplicationRegistrationNotExist, AuthorizationAgent } from "./src/authorization-agent";
import { getPodUrlAll } from "@inrupt/solid-client";
import { ProfileDocument } from "./src/profile-document";
import { authorizationAgentUrl2webId, webId2AuthorizationAgentUrl } from "./src/utils/uri-convert";
import { AccessApprovalHandler } from "./src/handlers/AccessApprovalHandler";
import { ApplicationRegistration } from "solid-interoperability/src/data-management/data-model/agent-registration/application-registration"
import { ApplicationAgent, SocialAgent } from "solid-interoperability";
import { createContainer, insertTurtleResource, readContainer as readResource } from "./src/utils/modify-pod";
import { serializeTurtle } from "./src/utils/turtle-serializer";

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

const accessApprovalHandler = new AccessApprovalHandler();


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

app.get("/login", async (req, res) => {
    // 1. Create a new Session
    const session = new Session();
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
        redirectUrl: `${protocol}${address}:${port}/login/callback`,
        // Set to the user's Solid Identity Provider; e.g., "https://login.inrupt.com"
        oidcIssuer: oidcIssuers[2],
        // Pick an application name that will be shown when asked
        // to approve the application's access to the requested data.
        clientName: "Authorization Agent",
        handleRedirect: redirectToSolidIdentityProvider,
    });
});

app.get("/login/callback", async (req, res) => {
    // 3. If the user is sent back to the `redirectUrl` provided in step 2,
    //    it means that the login has been initiated and can be completed. In
    //    particular, initiating the login stores the session in storage,
    //    which means it can be retrieved as follows.
    const session = await getSessionFromStorage(req.session!.sessionId);

    // 4. With your session back from storage, you are now able to
    //    complete the login process using the data appended to it as query
    //    parameters in req.url by the Solid Identity Provider:
    await session!.handleIncomingRedirect(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    );

    // 5. `session` now contains an authenticated Session instance.
    const webId = session!.info.webId!
    if (session!.info.isLoggedIn) {
        return res.send(`<p>Logged in with the WebID ${webId}.</p>`);
    }
});

// 6. Once you are logged in, you can retrieve the session from storage,
//    and perform authenticated fetches.
app.get("/fetch", async (req, res) => {
    if (typeof req.query["resource"] === "undefined") {
        res.send(
            "<p>Please pass the (encoded) URL of the Resource you want to fetch using `?resource=&lt;resource URL&gt;`.</p>",
        );
    }
    const session = await getSessionFromStorage(req.session!.sessionId);
    const f = req.query["resource"];
    console.log(await (await session!.fetch(<string>f)).text());
    res.send("<p>Performed authenticated fetch.</p>");
});

// 7. To log out a session, just retrieve the session from storage, and
//    call the .logout method.
app.get("/logout", async (req, res) => {
    const session = await getSessionFromStorage(req.session!.sessionId);
    session!.logout();
    res.send(`<p>Logged out.</p>`);
});

// 8. On the server side, you can also list all registered sessions using the
//    getSessionIdFromStorageAll function.
app.get("/", async (req, res) => {
    const sessionIds = await getSessionIdFromStorageAll();
    for (const a in sessionIds) {
        // Do something with the session ID...
    }
    res.send(`<p>There are currently [${sessionIds.length}] visitors.</p>`);
});

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

const authorization_router = express.Router()
app.use('/agents', authorization_router);

authorization_router.get("/new", async (req, res) => {
    // 1. Create a new Session
    const session = new Session();
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

authorization_router.get("/new/callback", async (req, res) => {
    // 3. If the user is sent back to the `redirectUrl` provided in step 2,
    //    it means that the login has been initiated and can be completed. In
    //    particular, initiating the login stores the session in storage,
    //    which means it can be retrieved as follows.
    const session = await getSessionFromStorage(req.session!.sessionId);

    // 4. With your session back from storage, you are now able to
    //    complete the login process using the data appended to it as query
    //    parameters in req.url by the Solid Identity Provider:
    await session!.handleIncomingRedirect(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    );

    // 5. `session` now contains an authenticated Session instance.
    const webId = session!.info.webId!
    const agent_URI = webId2AuthorizationAgentUrl(webId)
    const profile_document: ProfileDocument = await ProfileDocument.getProfileDocument(webId)

    if (!profile_document.hasAuthorizationAgent(agent_URI)) {
        profile_document.addhasAuthorizationAgent(agent_URI)
        profile_document.updateProfile(session!)
    }

    const pods = await getPodUrlAll(webId, { fetch: session!.fetch })
    cache.set(webId, new AuthorizationAgent(new SocialAgent(webId), new ApplicationAgent(agent_URI), pods[0], session!))

    cache.get(webId)?.createRegistriesSet()
    
    const sess = cache.get(webId)?.session as Session

    console.log("INSERT DOCUMENT")
    await insertTurtleResource(sess, cache.get(webId)?.registries_container + "testtesttestaabbbbb", await serializeTurtle(profile_document.dataset, { "interop": "http://www.w3.org/ns/solid/interop#" }))
    console.log("INSERTED DOCUMENT")
    console.log("READ DOCUMENT")
    console.log(await readResource(sess, cache.get(webId)?.registries_container + "testtesttestaabbbbb"))
    // console.log(await readContainer(cache.get(webId)?.session!, "https://puvikaran.solidcommunity.net/profile/abcde"))
    

    // console.log(await readContainer(cache.get(webId)?.session!, "https://puvikaran1.solidcommunity.net/privatae/"))
    // await insertFile(session!, "https://puvikaran.solidcommunity.net/profile/abcde/", profile_document)
    // await createContainer(session!, "https://puvikaran.solidcommunity.net/profile/ab/aaaaa/", await serializeTurtle(profile_document, { "interop": "http://www.w3.org/ns/solid/interop#" }))
    // await updateContainer(session!, "https://puvikaran.solidcommunity.net/profile/ab/aaaaa/.meta", profile_document)
    if (session!.info.isLoggedIn) {
        return res.send(`<p>Logged in with the WebID ${webId}. <a herf="localhost:3001/agents/new"></p>`);
    }
});

authorization_router.get("/:webId", (req, res) => {
    const authorization_agent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    // return turtle document with the redirecct endpoints
})

// return the agent registration of the requesting application agent
authorization_router.head("/:webId", (req, res) => {
    const authorization_agent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    const client_id : string = req.query.client_id as string
    console.log(client_id)
    const registration : ApplicationRegistration | undefined = authorization_agent.findApplicationRegistration(client_id)
    if (registration) {

    }
    else {
        res.status(400)
    }
})

authorization_router.get("/:webId/redirect", (req, res) => {
    const authorization_agent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    const { client_id } = req.query;
    const approval: boolean = accessApprovalHandler.requestAccessApproval();
    if(approval){
        res.status(200).send('You got access');
    }
    else{
        res.status(403).send('Your request got rejected');
    }
})

authorization_router.post("/:webId/result", (req, res) => {
    const authorization_agent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    const client_id = req.query.client_id
    // return the page where the user can approve or reject access
})

export { app };


// save(url : string, document : turtle)