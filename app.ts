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
import { SocialAgentProfileDocument } from "./src/profile-documents/social-agent-profile-document";
import { authorizationAgentUrl2webId, webId2AuthorizationAgentUrl } from "./src/utils/uri-convert";
import { AccessApprovalHandler } from "./src/handlers/AccessApprovalHandler";
import { ApplicationRegistration } from "solid-interoperability/src/data-management/data-model/agent-registration/application-registration"
import { ApplicationAgent, serializeTurtle } from "solid-interoperability";
import { deleteContainerResource, insertTurtleResource, readResource } from "./src/utils/modify-pod";
import { ApplicationProfileDocument } from "./src/profile-documents/application-profile-document";
import { DataAccessScope, DataAccessScopeAll } from "./src/application/data-access-scope";
import { AccessNeedGroup } from "./src/application/access-need-group";
import Link from "http-link-header";
import path from "path";
import { RedisSolidStorage } from "./src/redis/redis-storage";
import { getResource } from "./src/rdf-document";
import { Store, DataFactory } from "n3";
import { INTEROP, TYPE_A } from "./src/namespace";

const { namedNode } = DataFactory

config();
const app = express();
export const port = parseInt(process.env.PORT || "3000");
export const address = process.env.ADDRESS || "localhost";
const hostname = "0.0.0.0";
const useHttps = process.env?.HTTPS == "TRUE";
export const protocol = `http${useHttps ? "s" : ""}://`;
const privateKey = process.env.PRIVATEKEY ?? "";
const certificate = process.env.CERTIFICATE ?? "";

const oidcIssuers = ["https://login.inrupt.com", "https://solidweb.me", "https://solidcommunity.net", "http://localhost:3000/"]

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

if (useHttps) {
    const options = {
        key: fs.readFileSync(privateKey),
        cert: fs.readFileSync(certificate),
    };

    const server = https.createServer(options, app);

    server.listen(port, hostname, () => {
        console.log(`Server running at https://${address}:${port}`);
    });
} else {
    app.listen(port, hostname, () => {
        console.log(`Server running at http://${address}:${port}`);
    });
}

const authorizationRouter = express.Router()
app.use('/agents', authorizationRouter);

authorizationRouter.get("/new", async (req, res) => {
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
        oidcIssuer: oidcIssuers[3],
        // Pick an application name that will be shown when asked
        // to approve the application's access to the requested data.
        clientName: "Authorization Agent",
        handleRedirect: redirectToSolidIdentityProvider,
    });
})

/**
 * Gets the existing authorization agents if they exist in the cache when starting the service.
 */
async function getAuthorizationAgentsFromCache() {
    try {
        const sessionIds = await getSessionIdFromStorageAll(new RedisSolidStorage());

        for (const id of sessionIds) {
            const session = await getSessionFromStorage(id, new RedisSolidStorage());

            if (!session)
                continue;

            const webId = session.info.webId!;
            const autho = await AuthorizationAgent.new(session)
            await autho.setRegistriesSetContainer();
            cache.set(webId, autho);
        }
    } catch (error) {
        console.error("Error in getAuthorizationAgentsFromCache:", error);
    }
}

/**
 * Used to removed the previous session
 * @param webId Id for the Application
 * @param expectSessionId The session id
 */
async function removePreviousSession(webId: string, expectSessionId: string) {
    try {
        const sessionIds = await getSessionIdFromStorageAll(new RedisSolidStorage());

        for (const id of sessionIds.filter(id => id !== expectSessionId)) {
            const session = await getSessionFromStorage(id, new RedisSolidStorage());

            if (session && session.info.webId === webId)
                session.logout();
        }
    } catch (error) {
        console.error("Error in removePreviousSession:", error);
    }
}


authorizationRouter.get("/new/callback", async (req, res) => {
    try {
        // 3. If the user is sent back to the `redirectUrl` provided in step 2,
        //    it means that the login has been initiated and can be completed. In
        //    particular, initiating the login stores the session in storage,
        //    which means it can be retrieved as follows.
        const session = await getSessionFromStorage(req.session!.sessionId, new RedisSolidStorage());

        if (!session)
            return res.sendStatus(403).send();

        // 4. With your session back from storage, you are now able to
        //    complete the login process using the data appended to it as query
        //    parameters in req.url by the Solid Identity Provider:
        await session.handleIncomingRedirect(
            `${req.protocol}://${req.get("host")}${req.originalUrl}`
        );

        const webId = session.info.webId!;
        removePreviousSession(webId, req.session!.sessionId);

        let authAgent = cache.get(webId);

        if (!authAgent) {
            const agentURI = webId2AuthorizationAgentUrl(webId);
            const profileDocument: SocialAgentProfileDocument = await getResource(SocialAgentProfileDocument, session.fetch, webId);

            if (!profileDocument.hasAuthorizationAgent(agentURI))
                await profileDocument.addhasAuthorizationAgent(agentURI, session.fetch);

            authAgent = await AuthorizationAgent.new(session);
            cache.set(webId, authAgent);
            await authAgent.setRegistriesSetContainer();
        } else
            authAgent.session = session;

        if (session!.info.isLoggedIn)
            return res.send(`<p>Logged in with the WebID ${webId}. <a href="localhost:3001/agents/new"></p>`);
    } catch (error) {
        console.error("Error in authorizationRouter callback:", error);
        return res.status(500).send("Internal Server Error");
    }
});


/*
The endpoint for requesting if a Application have access to the Pod.
*/
authorizationRouter.get("/:webId", async (req, res) => {
    const authorizationAgent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
    if (!authorizationAgent) {
        return res.sendStatus(400);
    }

    if (req.method == "HEAD") {
        if (typeof(req.query.client_id) != "string") {
            res.status(400).send('Bad Request: Missing "client_id" parameter');
        }
    
        const authorizationAgent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!
        const clientId: string = req.query.client_id as string
        try {
            const registration: ApplicationRegistration = await authorizationAgent.findAgentRegistrationInPod(clientId) as ApplicationRegistration
            console.log(registration.id)
            res.header('Link', `<${clientId}>; anchor="${registration.id}"; rel="https://www.w3.org/ns/solid/interop#registeredAgent"`)
            return res.status(200).send();
        } catch (error) {
            console.error(error)
            return res.status(400).send("No registration found for this WebId: " + req.params.webId);
        }
    }
    else {
        const authorizationAgentId = `${protocol}://${address}:${port}/agents/${req.params.webId}/`
        const subject = namedNode(authorizationAgentId)
        const store = new Store()
        store.addQuad(subject, namedNode(TYPE_A), namedNode(INTEROP + "AuthorizationAgent"))
        store.addQuad(subject, namedNode(INTEROP + "hasAuthorizationRedirectEndpoint"), namedNode(authorizationAgentId + "wants-access"))
        res.setHeader('content-type', 'text/turtle');
        return res.status(200).send(await serializeTurtle(store, {}));
    }
})

/*
The endpoint for the Application wanting access to a Pod
*/
authorizationRouter.post("/:webId/wants-access", async (req, res) => {
    if (typeof(req.query.client_id) != "string") {
        res.status(400).send('Bad Request: Missing "client_id" parameter');
    }

    const clientId: string = req.query.client_id as string;

    try {
        const authorizationAgent: AuthorizationAgent = cache.get(authorizationAgentUrl2webId(req.params.webId))!;
        const accessApprovalHandler = new AccessApprovalHandler();
        const approved: boolean = accessApprovalHandler.requestAccessApproval();
        const fetch = authorizationAgent.session.fetch;

        if (approved) {
            const applicationProfileDocument = await getResource(ApplicationProfileDocument, fetch, clientId);
            const accesNeedGroups = await applicationProfileDocument.gethasAccessNeedGroup(fetch);

            const access = new Map<AccessNeedGroup, DataAccessScope[]>();

            for (const accessNeedGroup of accesNeedGroups) {
                const accessNeeds = await accessNeedGroup.getHasAccessNeed(fetch);
                const dataAccessScopes = accessNeeds.map(accessNeed => new DataAccessScopeAll(accessNeed));
                access.set(accessNeedGroup, dataAccessScopes);
            }

            await authorizationAgent.insertNewAgentToPod(accessApprovalHandler.getApprovalStatus(new ApplicationAgent(clientId), access));
            res.status(202).send();
        } else {
            res.status(403).send('Your request got rejected');
        }
    } catch (error) {
        console.error("Error in /:webId/wants-access:", error);
        res.status(500).send("Internal Server Error");
    }
});

const podsRouter = express.Router()
app.use('/pods', podsRouter);

/*
Endpoint for inserting data into the Pod
*/
podsRouter.put("/:dataId/:webId", async (req, res) => {
    const dataId: string = req.params.dataId;
    const authorization: string = req.headers["Authorization"] as string;
    const link: string = req.headers["Link"] as string;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);

    if (!authorization || !link)
        return res.status(400).json({ error: "Both Authorization and Link headers are required." });

    if (!authorizationAgent)
        return res.status(401).json({ error: "Invalid or expired authorization agent." });

    try {
        const linkValue = Link.parse(link);

        if (linkValue.refs.length === 1) {
            const dataInstanceIRI: string = linkValue.refs[0].uri + '/' + dataId;
            await insertTurtleResource(authorizationAgent.session.fetch, dataInstanceIRI, req.body);
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
podsRouter.get("/:dataIRI/:webId", async (req, res) => {
    const dataIRI: string = req.params.dataIRI;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);

    try {
        if (!authorizationAgent)
            throw new Error("Invalid or expired authorization agent.");

        const data = await readResource(authorizationAgent.session.fetch, dataIRI);
        res.status(200).send(data);
    } catch (error) {
        console.error("Error retrieving data from the Pod:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/*
Endpoint for deleting data from the Pod
*/
podsRouter.delete("/:dataIRI/:webId", async (req, res) => {
    const dataId: string = req.params.dataIRI;
    const authorization: string = req.headers["Authorization"] as string;
    const link: string = req.headers["Link"] as string;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);

    if (!authorization || !link)
        return res.status(400).json({ error: "Both Authorization and Link headers are required." });

    if (!authorizationAgent)
        return res.status(401).json({ error: "Invalid or expired authorization agent." });

    try {
        const linkValue = Link.parse(link);

        if (linkValue.refs.length === 1) {
            const dataInstanceIRI: string = linkValue.refs[0].uri + '/' + dataId;
            await deleteContainerResource(authorizationAgent.session.fetch, dataInstanceIRI);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: "Only one Link header is allowed." });
        }
    } catch (error) {
        console.error("Error processing the delete request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const projectronRouter = express.Router()
app.use('/projectron', projectronRouter);

projectronRouter.get("/", async (req, res) => {
    const options = {
        root: path.join(__dirname, "../")
    };
    return res.status(200).sendFile("test/projectron.ttl", options);
});

export { app };

getAuthorizationAgentsFromCache();