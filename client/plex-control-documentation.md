
A Developer's Guide to Remote Playback Control via the Plex Companion Protocol


1.0 Introduction: Deconstructing Plex Remote Control

The Plex ecosystem, celebrated for its robust media management and cross-platform accessibility, offers a powerful yet sparsely documented capability: the remote control of one Plex client by another. For developers, harnessing this feature presents an opportunity to create sophisticated, custom integrations that enhance the user experience. This report provides a definitive technical guide for implementing a specific, high-value feature: triggering media playback from a custom web application directly to an official Plex client application running on an AndroidTV device.

1.1 The Objective: From Web App to TV Screen

The central objective is to enable a custom-built web application to function as a "controller," capable of instructing a standard, unmodified Plex for AndroidTV application to begin playback of a specific media item from a user's library. This action is conceptually similar to the "casting" or "flinging" functionality seen in official Plex applications, where a user can browse media on their phone and initiate playback on their television.1 This guide deconstructs the underlying technical mechanisms required to replicate this behavior programmatically, providing a roadmap for developers to integrate this functionality into their own projects.

1.2 The Three-Part System: Controller, Broker, and Receiver

Achieving remote playback control involves a coordinated interaction between three distinct components. A clear understanding of the roles and responsibilities of each is fundamental to successful implementation.
The Controller: This is the application that originates the playback command. In the context of this report, the Controller is the user's custom web application. It is responsible for discovering available players, identifying the desired media, and constructing the appropriate API request. Official Plex apps on mobile devices or the web often serve as Controllers.3
The Broker (Plex Media Server - PMS): The PMS is the central nervous system of the entire operation. It is far more than a simple media repository; it acts as an essential intermediary that authenticates requests, maintains a real-time roster of all connected clients, and relays commands between the Controller and the Receiver. Nearly all communication from the custom web application will be directed at the PMS, not the final playback device.
The Receiver: This is the application that ultimately plays the media content. For this report, the target Receiver is the official Plex for AndroidTV application. According to Plex's own classification, AndroidTV is a "Receiver-Only" client, meaning it is designed to be controlled but cannot initiate control of other clients.3

1.3 The End-to-End Workflow at a Glance

The process of initiating remote playback can be summarized in a high-level sequence of events. This workflow provides a conceptual map that will be detailed exhaustively in the subsequent sections of this report.
Discovery: The Controller identifies the target AndroidTV Receiver on the local network. This is most reliably achieved by querying the Plex Media Server, which maintains a list of known clients.
Identification: The Controller gathers a set of unique identifiers required for the command: an authentication token, the server's unique ID, the target Receiver's unique ID, and the unique ID of the media item to be played.
Authentication: The Controller authenticates all its requests to the PMS by including a valid authentication token.
Execution: The Controller constructs and sends a precisely formatted HTTP command to a specific endpoint on the PMS. This command instructs the server to create a "play queue" containing the desired media item.
Relay: The PMS receives the command and relays the playback instruction to the target AndroidTV Receiver using its own internal communication protocols. The Receiver then connects to the PMS and begins streaming the media.

1.4 A Note on Documentation and Reverse Engineering

It is imperative to establish at the outset that the Plex Companion protocol and its associated control APIs are not officially and comprehensively documented by Plex for public use.4 The functionality exists to support Plex's own ecosystem of applications, but a formal, stable, and supported public API for third-party developers is not provided.6
Consequently, the knowledge presented in this report is the result of a careful synthesis of information from multiple sources: fragmented official support articles, community forum discussions, and, most importantly, the analysis of network traffic and the source code of third-party libraries developed through reverse engineering.7 While the methods described herein are proven to be effective, they must be considered fragile. Plex could alter, deprecate, or remove the underlying endpoints in future software updates without notice, potentially breaking any custom integration built upon them. Developers must proceed with this understanding and implement robust error handling to manage such possibilities.

2.0 The Plex Companion Architecture: A Conceptual Deep Dive

To successfully engineer a custom controller, a formal understanding of the Plex Companion architecture is essential. This is not a single, monolithic API but rather a system of coordinated protocols and endpoints. This section provides a detailed conceptual model of this architecture, clarifying the roles of each component and the nature of their interactions.

2.1 Defining "Plex Companion"

"Plex Companion" is the official designation for the remote control protocol that enables one Plex application to control another.2 It is the technological foundation for features like "flinging" content from a mobile device to a smart TV or using a phone as a remote control for a desktop player. The protocol governs how devices discover each other, how control sessions are established, and how playback commands are transmitted and executed within the Plex ecosystem.

2.2 The Controller/Receiver Model

The Plex Companion architecture is fundamentally based on a Controller/Receiver model. Plex explicitly defines these two roles in its support documentation, and understanding this division is the first step in architecting a custom solution.3
Controller: This is the application that initiates and sends commands. It functions as the "remote control" in the interaction. Examples of official Plex apps that can act as Controllers include the Android and iOS mobile apps, the Plex Web App, and the desktop applications for Windows, macOS, and Linux.3 The custom web application at the heart of this report will be designed to function as a Controller.
Receiver: This is the application that receives commands and performs the corresponding action, which is typically media playback. Receivers are the playback endpoints. The list of "Receiver-Only" applications includes Plex for Android TV, Amazon Fire TV, Apple TV, Roku, PlayStation, Xbox, and various smart TVs.3 This designation is critical: it confirms that the AndroidTV client is built to be controlled and is a valid target for this project, but it also means it cannot be used to control other devices.

2.3 The Pivotal Role of the Plex Media Server (PMS)

A common misconception when approaching Plex remote control is to assume a direct, peer-to-peer connection between the Controller and the Receiver. While some older or different Plex clients might have supported direct HTTP control, the modern and most common implementation, especially for "Receiver-Only" clients like AndroidTV, is a server-brokered model.
The control mechanism is fundamentally server-centric. Analysis of the control endpoints and community-documented command structures reveals that commands are dispatched to the Plex Media Server, which then acts as a broker to the client.4 Instead of the custom web app sending a "play" command directly to the AndroidTV's IP address, it sends a more complex "playMedia" instruction to the PMS. This instruction essentially tells the server, "Create a play queue with this media item and assign it to that specific client." The PMS then uses its own persistent communication channels—which may include push notifications or other proprietary protocols—to inform the AndroidTV client that a new play queue is ready for it.
This server-centric design offers several architectural advantages for the Plex ecosystem. It centralizes authentication and authorization, ensuring that only permitted users and applications can issue commands. It provides a consistent control API for controllers, abstracting away the platform-specific implementation details of each receiver. A controller sends the same command to the PMS whether the target is an AndroidTV, a Roku, or an Apple TV. Finally, it simplifies discovery, as the PMS typically maintains an up-to-date roster of all clients that have recently communicated with it. This architectural pattern is the single most important concept to grasp, as it dictates that the developer's primary API target is the PMS, not the AndroidTV client itself.

3.0 Phase 1: Discovering the AndroidTV Client

Before any control can be exerted, the Controller application must discover and identify the target Receiver on the network. There are two primary methods for achieving this within the Plex ecosystem. While both can yield the necessary information, their mechanisms, reliability, and suitability for a web application differ significantly.

3.1 Method A: The G'Day Mate (GDM) Protocol (Low-Level Discovery)

G'Day Mate (GDM) is Plex's proprietary protocol for local network service discovery.9 It is built upon the User Datagram Protocol (UDP) and uses multicast and broadcast messages to allow Plex applications to find each other automatically without prior configuration.9

3.1.1 Mechanism and Packet Structure

The GDM protocol operates by sending out specific UDP packets and listening for responses. The content and destination of these packets differ depending on whether the application is searching for servers or clients.12
Discovering Servers: A client application looking for a Plex Media Server sends a UDP multicast message containing the payload M-SEARCH * HTTP/1.0 to the multicast address 239.0.0.250 on port 32414. Any PMS on the network listening on this address will respond directly to the client.
Discovering Clients: A Controller application looking for playable clients sends a UDP broadcast message with the same M-SEARCH * HTTP/1.0 payload to the broadcast address 255.255.255.255 on port 32412. All Plex clients on the network configured as receivers will respond.
The response from a discovered device is a plain-text, HTTP-like message. A typical response from a Plex client contains key-value pairs that provide essential information for identification and control.13 Key fields include:
Name: The user-friendly name of the client (e.g., "Living Room TV").
Product: The type of Plex application (e.g., "Plex for Android (TV)").
Port: The port on which the client's own limited control API might be listening.
Resource-Identifier: This is the crucial unique identifier for the client, also known as the clientIdentifier.

3.1.2 Network Requirements and Limitations

The reliance on UDP multicast and broadcast presents several significant challenges. For GDM to function correctly, the network infrastructure between the Controller and Receiver must permit this type of traffic. This requires specific UDP ports—notably 32410, 32412, 32413, and 32414—to be open on any local firewalls on the participating machines.14
Furthermore, most consumer and enterprise networking equipment, by default, does not forward multicast or broadcast traffic across different subnets or Virtual LANs (VLANs).11 If the web application server and the AndroidTV are on separate network segments, GDM discovery will fail without advanced network configuration, such as a multicast relay or repeater. Implementing UDP broadcast/multicast logic from within a standard browser-based web application is also fraught with difficulty due to the security sandboxing of modern web browsers.

3.1.3 Security Considerations

It is also worth noting that the discovery mechanism used by Plex has been historically associated with security vulnerabilities. A related component of the discovery service, the Simple Service Discovery Protocol (SSDP), was found to be abusable for Distributed Denial of Service (DDoS) reflection and amplification attacks when a Plex server was improperly exposed to the internet.17 While Plex has issued patches to mitigate this specific vulnerability in modern PMS versions, it serves as a reminder of the inherent risks of exposing low-level network discovery protocols.20

3.2 Method B: The Server-Side Client Roster (High-Level Discovery)

A far simpler, more reliable, and web-application-friendly method for client discovery is to query the Plex Media Server directly. The PMS maintains a dynamic roster of all client applications that have recently connected to or communicated with it. A Controller can access this list via a standard HTTP GET request to the PMS API.

3.2.1 The /clients Endpoint

The primary endpoint for this method is GET http://{server_ip}:32400/clients.2 A successful request to this endpoint, authenticated with a valid Plex token, returns an XML document that enumerates all known clients.

3.2.2 Response Analysis

The XML response contains a <Server> element for each client device. Each of these elements possesses a set of attributes that provide all the necessary information to identify and target the client for a control command. The most important attributes are 2:
name: The friendly name of the client (e.g., "SHIELD Android TV").
host: The last known IP address of the client.
port: The port on which the client is listening.
machineIdentifier: The globally unique identifier for the client instance. This is the value needed for the X-Plex-Target-Client-Identifier header in the control command.
product: The name of the client software (e.g., "Plex for Android (TV)"), which is useful for filtering the list to find the correct device type.
protocol: The protocol capabilities of the client.

3.2.3 Abstraction in Modern Libraries

This method is so effective and straightforward that it has become the standard approach for client discovery in all major third-party Plex API libraries. For instance, the popular python-plexapi library abstracts this entire process into a single function call, plex.clients().21 Similarly, modern SDKs generated from OpenAPI specifications, such as
@lukehagar/plexjs and its Python counterpart, provide a get_available_clients method that performs this query.22 This high-level abstraction makes it the clear choice for any new development.

3.3 Comparative Analysis and Recommendation

A direct comparison of the two discovery methods reveals a clear winner for the intended use case.
GDM (Low-Level):
Pros: Provides real-time discovery directly from the clients themselves, without needing the PMS to be aware of them first.
Cons: Technologically complex to implement, especially in a web context. Relies on UDP broadcast/multicast, which is often blocked on managed or segmented networks. Carries historical security baggage.
Server Roster (High-Level):
Pros: Utilizes a simple, standard HTTP GET request, which is trivial to implement in any web application framework. It is highly reliable on typical home networks, even those with multiple subnets, as long as the Controller can establish a standard TCP connection to the PMS. It provides all necessary identifiers in a single, well-structured response.
Cons: There may be a slight latency between a client starting up and it appearing in the server's list. This is generally negligible in practice.
Recommendation: For building a custom web application to control an AndroidTV client, Method B, querying the server-side client roster via the /clients endpoint, is unequivocally the recommended approach. It is simpler, more robust, more secure, and aligns perfectly with the technological capabilities of a web-based controller. The practical workflow demonstrated by libraries like node-plex-control, which exclusively use this method, serves as a strong validation of its superiority for this task.25 The implementation strategy should therefore be to connect to the server, retrieve the list of clients, and then filter that list to find the target AndroidTV based on its
name or product attribute.

4.0 Phase 2: Assembling the Necessary Identifiers

A successful remote playback command is not a single, simple instruction. It is a composite request that depends on a precise collection of unique identifiers. Each identifier acts as a key, unlocking a different part of the control chain. Before the final command can be constructed, the Controller application must systematically acquire four distinct pieces of information. This section serves as a detailed guide to sourcing each of these critical identifiers.

4.1 The Master Key: The X-Plex-Token

The X-Plex-Token is the primary mechanism for authentication across the Plex Media Server API. It functions as a session token or API key, verifying that the application making the request has the authority to do so.
Purpose: Nearly every API call to the PMS, from listing libraries to initiating playback, must be accompanied by a valid X-Plex-Token in the HTTP headers. Any request lacking this token, or providing an invalid one, will be rejected with a 401 Unauthorized status code.5
Acquisition: While there are programmatic ways to obtain a token through an authentication flow (e.g., using username/password or a PIN-based login), the most straightforward method for a developer's own setup is to retrieve it directly. This can be done by logging into the Plex Web App (app.plex.tv), opening the browser's developer tools, and inspecting the network requests made to the PMS. The X-Plex-Token will be present as a header or query parameter in these requests.
Implementation: All reputable Plex API libraries are designed to handle this token seamlessly. During the initialization of the API client object, the developer provides the token. The library then automatically includes the X-Plex-Token header in all subsequent API calls it makes, abstracting the authentication process away from the developer.21

4.2 The Server's Identity: machineIdentifier

This is the unique, persistent identifier for the Plex Media Server instance itself. It is a long hexadecimal string that distinguishes one PMS from another.
Purpose: The server's machineIdentifier is a required parameter in the final playMedia command. It explicitly tells the Plex ecosystem which server is the source of the media to be played, which is crucial in environments where a user might have access to multiple servers.
Acquisition: The most direct and reliable method to obtain the server's machineIdentifier is to make an authenticated GET request to the /identity endpoint on the PMS: http://{server_ip}:32400/identity. This endpoint returns a minimal XML response containing a <MediaContainer> element, and the machineIdentifier is one of its attributes.29 Unlike most other requests, this specific endpoint can sometimes respond even without a token, but it is best practice to include it.30 Alternatively, when using a comprehensive library like
python-plexapi, the machineIdentifier is often populated as a property of the main server object after a successful connection is established.32

4.3 The Target's Identity: clientIdentifier

This is the unique identifier for the specific client device that will receive the playback command—in this case, the AndroidTV.
Purpose: This identifier is used in the X-Plex-Target-Client-Identifier HTTP header of the control command. This header is what directs the PMS to relay the playback instruction to the correct device among all the clients it knows about. Without this, the server would not know where to send the command.
Acquisition: The clientIdentifier is obtained during the discovery phase detailed in Section 3.2. When querying the /clients endpoint on the PMS, the returned XML contains a list of <Server> elements (one for each client). The machineIdentifier attribute of the element corresponding to the AndroidTV is the value needed.2
A Note on Terminology: The Plex API's nomenclature can be a source of confusion. In the /clients response, the client's unique ID is labeled machineIdentifier. However, in the context of the control command, it functions as the clientIdentifier. Furthermore, this must be distinguished from the X-Plex-Client-Identifier header. The latter is a self-assigned identifier that the Controller application creates to identify itself to the server. It is crucial to use the ID from the /clients response for the X-Plex-Target-Client-Identifier header and a separate, self-generated UUID for the X-Plex-Client-Identifier header.7

4.4 The Media's Identity: ratingKey

The ratingKey is the integer primary key that uniquely identifies a specific media item—a movie, a TV show, an episode, a song, or an album—within the Plex Media Server's database.
Purpose: This is the most crucial parameter for defining what to play. The ratingKey is used to construct the key parameter in the final playMedia command.
Acquisition: The ratingKey cannot be guessed; it must be retrieved by searching or browsing the PMS library via the API. This is a multi-step process:
List Library Sections: First, make a GET request to /library/sections. This returns a list of all libraries on the server (e.g., "Movies," "TV Shows"). From this response, extract the numeric key for the desired library section.
Search the Section: Using the section key from the previous step, perform a search. For example, to find the movie "Inception" in the movie library (let's assume its key is '1'), the request would be: GET /library/sections/1/all?title=Inception. The API supports a wide range of filters for more specific searches, such as by year, actor, or resolution.34
Extract the ratingKey: The search response will be an XML or JSON document containing a list of media items that match the query. For each item (represented by a <Video> element for movies or a <Directory> element for TV shows), there will be a ratingKey attribute. This integer is the identifier needed for the playback command.34 The full API path for a media item is typically
/library/metadata/{ratingKey}.36
The following table summarizes these four essential identifiers, serving as a checklist for the developer.
Identifier Name
Description
Acquisition Method
Example API Endpoint/Source
Usage in Final Command
X-Plex-Token
Authentication token for the PMS user account.
Manual retrieval from Plex Web App network requests or programmatic authentication flow.
N/A (Found in existing requests)
Value for the X-Plex-Token HTTP header.
Server machineIdentifier
The unique ID of the Plex Media Server instance.
GET request to the PMS.
http://{server_ip}:32400/identity
Value for the machineIdentifier URL parameter.
Client clientIdentifier
The unique ID of the target playback device (AndroidTV).
GET request to the PMS.
http://{server_ip}:32400/clients
Value for the X-Plex-Target-Client-Identifier HTTP header.
Media ratingKey
The unique database ID of the movie or show to be played.
GET request to search a library section on the PMS.
http://{server_ip}:32400/library/sections/{id}/all?title=...
Used to construct the key URL parameter (e.g., key=/library/metadata/{ratingKey}).


5.0 Phase 3: Executing the Playback Command

With all four essential identifiers—the authentication token, the server identifier, the client identifier, and the media identifier—successfully assembled, the final phase is to construct and dispatch the API call that initiates playback. This section provides a detailed breakdown of the playMedia command, its required components, and a complete implementation example.

5.1 The playMedia Command: The Heart of the Operation

The core of the remote control mechanism is the playMedia command. However, it is crucial to understand its function precisely. The Controller does not directly command the Receiver to "play." Instead, it sends a request to the PMS, the broker, to create and assign a "play queue" to the target client. A play queue is a list of one or more media items to be played in sequence. The PMS, upon receiving a valid playMedia request, notifies the specified client that a new queue is available. The client then takes the initiative to connect to the server and begin playback of the items in that queue. This server-brokered approach is elegantly abstracted by libraries like python-plexapi in their playMedia functions, but understanding the underlying process is key to debugging.39
The command is executed by sending a standard HTTP GET request to the following endpoint on the Plex Media Server 4:

/player/playback/playMedia

5.2 Constructing the Request: Headers and Parameters

The success of the playMedia command hinges entirely on the correct construction of its HTTP headers and URL query parameters. Every piece of information gathered in the previous phase is used here. An omission or error in any component will result in failure.

5.2.1 Required HTTP Headers

These headers provide the context for the command, identifying the controller and specifying the target.
X-Plex-Token: The authentication token for the user account, as obtained in Section 4.1. This is non-negotiable for an authenticated server.5
X-Plex-Client-Identifier: A unique identifier for the Controller application itself. It is best practice to generate a UUID (v4) once and reuse it for the lifetime of the application. Registering a new identifier on every run can lead to a cluttered device list on the server and potential performance degradation.7
X-Plex-Product: The name of the Controller application (e.g., "My Custom Plex Browser"). This helps identify the application in the server's dashboard.28
X-Plex-Device-Name: A user-friendly name for the device running the Controller application (e.g., "Developer's Laptop").7
X-Plex-Platform: The platform on which the Controller is running (e.g., "Node.js," "Chrome," "Windows").28
X-Plex-Target-Client-Identifier: The clientIdentifier of the target AndroidTV, as obtained from the /clients endpoint in Section 4.3. This is the single most important header for directing the command to the correct Receiver.33

5.2.2 Required URL Query Parameters

These parameters are appended to the request URL and define the specifics of the playback session.
machineIdentifier: The machineIdentifier of the Plex Media Server that hosts the content, as obtained from the /identity endpoint in Section 4.2.29
key: The full API path to the media item to be played. This is constructed by prefixing the media's ratingKey (from Section 4.4) with /library/metadata/. For a movie with a ratingKey of 12345, the value would be /library/metadata/12345.39
protocol: The protocol the client should use to connect to the server, typically http for local playback.
address: The local IP address of the Plex Media Server.
port: The port of the Plex Media Server, which is almost always 32400.
commandID: A sequentially incrementing integer that identifies the command. Some clients rely on this to process commands in the correct order and to ignore duplicates. The Controller should maintain a counter, starting at 1, and increment it for every command it sends during its session.7
The following table provides a clear blueprint for constructing the API request.
Component
Description
Example Value
Method
HTTP Method
GET
Endpoint
Path on the PMS
/player/playback/playMedia
Header
X-Plex-Token
aBcDeFgHiJkLmNoPqRsT
Header
X-Plex-Client-Identifier
a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
Header
X-Plex-Product
MyPlexWebApp
Header
X-Plex-Device-Name
MyPlexWebApp
Header
X-Plex-Platform
Node.js
Header
X-Plex-Target-Client-Identifier
abcdefg123456789 (from AndroidTV)
Parameter
machineIdentifier
987654321fedcba (from PMS)
Parameter
key
/library/metadata/54321
Parameter
protocol
http
Parameter
address
192.168.1.100
Parameter
port
32400
Parameter
commandID
1

A full example URL would look like this (before URL encoding):
http://192.168.1.100:32400/player/playback/playMedia?machineIdentifier=987654321fedcba&key=/library/metadata/54321&protocol=http&address=192.168.1.100&port=32400&commandID=1

5.3 Complete Node.js Implementation Example

The following code block provides a complete, functional example using the node-plex-api library. This library is chosen for its direct, low-level access that clearly demonstrates the principles discussed. While higher-level libraries like node-plex-control exist, this example makes the underlying API calls explicit for educational purposes.

JavaScript


// A comprehensive Node.js example for triggering Plex playback on an AndroidTV.
// This example uses the 'plex-api' package.
// To run: npm install plex-api

const PlexAPI = require('plex-api');

// --- Configuration ---
// These values must be replaced with your actual Plex server details.
const PLEX_SERVER_IP = '192.168.1.100'; // IP address of your Plex Media Server
const PLEX_SERVER_PORT = 32400;
const PLEX_TOKEN = 'YOUR_PLEX_TOKEN'; // Your X-Plex-Token
const TARGET_CLIENT_NAME = 'SHIELD Android TV'; // The name of your AndroidTV client as it appears in Plex
const MEDIA_TITLE_TO_PLAY = 'Inception'; // The title of the movie you want to play
const MEDIA_LIBRARY_NAME = 'Movies'; // The name of the library containing the media

// --- Controller Application Identifiers ---
// It's best practice to generate a UUID once and reuse it.
const CONTROLLER_IDENTIFIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CONTROLLER_PRODUCT_NAME = 'CustomPlexController';
const CONTROLLER_DEVICE_NAME = 'NodeJSController';
const CONTROLLER_PLATFORM = 'Node.js';

// Initialize the Plex API client
const client = new PlexAPI({
    hostname: PLEX_SERVER_IP,
    port: PLEX_SERVER_PORT,
    token: PLEX_TOKEN,
    // Provide the required client headers for all requests
    options: {
        identifier: CONTROLLER_IDENTIFIER,
        product: CONTROLLER_PRODUCT_NAME,
        deviceName: CONTROLLER_DEVICE_NAME,
        platform: CONTROLLER_PLATFORM,
    }
});

// A simple command counter
let commandID = 0;

async function findTargetClient(clientName) {
    console.log(`Searching for client: "${clientName}"...`);
    try {
        const response = await client.query('/clients');
        const clients = response.MediaContainer.Server;
        if (!clients) {
            throw new Error('No clients found on the server.');
        }

        // The response might be a single object or an array
        const clientList = Array.isArray(clients)? clients : [clients];
        
        const target = clientList.find(c => c.name === clientName);
        if (target) {
            console.log(`Found client: ${target.name} (ID: ${target.machineIdentifier})`);
            return {
                clientIdentifier: target.machineIdentifier,
                name: target.name,
                product: target.product,
            };
        } else {
            throw new Error(`Client "${clientName}" not found.`);
        }
    } catch (err) {
        console.error('Error finding clients:', err.message);
        throw err;
    }
}

async function findMedia(libraryName, mediaTitle) {
    console.log(`Searching for media: "${mediaTitle}" in library "${libraryName}"...`);
    try {
        // 1. Find the library section key
        const sectionsResponse = await client.query('/library/sections');
        const sections = sectionsResponse.MediaContainer.Directory;
        const library = sections.find(s => s.title === libraryName);

        if (!library) {
            throw new Error(`Library "${libraryName}" not found.`);
        }
        const libraryKey = library.key;
        console.log(`Found library "${libraryName}" with key: ${libraryKey}`);

        // 2. Search for the media item in that library
        const searchUri = `/library/sections/${libraryKey}/all?title=${encodeURIComponent(mediaTitle)}`;
        const mediaResponse = await client.query(searchUri);
        
        const mediaItems = mediaResponse.MediaContainer.Metadata;
        if (!mediaItems |

| mediaItems.length === 0) {
            throw new Error(`Media "${mediaTitle}" not found in library.`);
        }

        // Take the first match
        const media = Array.isArray(mediaItems)? mediaItems : mediaItems;
        console.log(`Found media: ${media.title} (ratingKey: ${media.ratingKey})`);
        return {
            ratingKey: media.ratingKey,
            key: media.key, // This is the path like /library/metadata/12345
            title: media.title,
        };

    } catch (err) {
        console.error('Error finding media:', err.message);
        throw err;
    }
}

async function getServerIdentifier() {
    console.log('Fetching server identifier...');
    try {
        const response = await client.query('/identity');
        const serverId = response.MediaContainer.machineIdentifier;
        if (!serverId) {
            throw new Error('Could not retrieve server machineIdentifier.');
        }
        console.log(`Server identifier: ${serverId}`);
        return serverId;
    } catch (err) {
        console.error('Error fetching server identifier:', err.message);
        throw err;
    }
}

async function triggerPlayback(targetClient, mediaItem, serverIdentifier) {
    commandID++;
    console.log(`Constructing playback command #${commandID}...`);

    const params = new URLSearchParams({
        machineIdentifier: serverIdentifier,
        key: mediaItem.key,
        protocol: 'http',
        address: PLEX_SERVER_IP,
        port: PLEX_SERVER_PORT,
        commandID: commandID,
    });

    const playbackUri = `/player/playback/playMedia?${params.toString()}`;
    
    console.log(`Sending command to play "${mediaItem.title}" on "${targetClient.name}"...`);

    try {
        // The 'plex-api' library requires extra headers to be passed this way
        // for targeting specific clients.
        await client.query({
            uri: playbackUri,
            extraHeaders: {
                'X-Plex-Target-Client-Identifier': targetClient.clientIdentifier
            }
        });
        console.log('Playback command sent successfully!');
    } catch (err) {
        // The server often returns an empty response on success, which can
        // cause a parsing error in some libraries. We can often ignore this
        // if the status code indicates success.
        if (err.statusCode >= 200 && err.statusCode < 300) {
            console.log('Playback command likely succeeded despite a response parsing error.');
        } else {
            console.error('Error sending playback command:', err.message);
            throw err;
        }
    }
}

// --- Main Execution ---
async function main() {
    try {
        console.log('--- Starting Plex Remote Playback Trigger ---');
        
        // Phase 1: Discover and Identify
        const targetClient = await findTargetClient(TARGET_CLIENT_NAME);
        const mediaToPlay = await findMedia(MEDIA_LIBRARY_NAME, MEDIA_TITLE_TO_PLAY);
        const serverId = await getServerIdentifier();

        // Phase 2: Execute
        await triggerPlayback(targetClient, mediaToPlay, serverId);

        console.log('--- Process Complete ---');
    } catch (error) {
        console.error('\n--- An error occurred during the process ---');
        // The specific error messages were already logged in the functions.
    }
}

main();




6.0 Implementation and Network Troubleshooting

Successfully implementing the remote control workflow requires more than just correct API calls; it demands a properly configured environment. The majority of failures in this process stem not from flawed code but from network configurations or server settings that impede the necessary communication between the Controller, the PMS, and the Receiver. This section addresses the most common points of failure and provides diagnostic guidance.

6.1 The Network Environment: The Most Common Point of Failure

The local network is a complex system where firewalls, routers, and network segmentation can inadvertently block the protocols Plex relies on.

6.1.1 Firewalls

Both the machine hosting the Plex Media Server and the AndroidTV client device may be running their own software firewalls (e.g., Windows Defender Firewall, iptables on Linux). For the server-brokered control method to work, the Controller application must be able to establish a TCP connection to the PMS on its primary port.
Rule: Ensure that any firewall on the PMS machine allows inbound TCP traffic on port 32400 from the IP address or subnet of the Controller application.

6.1.2 VLANs and Subnets

While the recommended server-side discovery method (Section 3.2) is more resilient to network segmentation than GDM, issues can still arise. If the Controller, PMS, and Receiver are on different IP subnets or VLANs, the router or layer 3 switch connecting them must be configured to allow traffic to flow between them.
GDM Failure: The GDM protocol (Method A) will definitively fail across subnets by default, as broadcast and multicast traffic is typically not routed.11
Server Roster Success: The server roster method (Method B) will succeed as long as the Controller can make an HTTP request to the PMS's IP address and port. The PMS's subsequent communication with the Receiver uses its own established connection, which is generally robust across a properly configured routed network.

6.1.3 DNS Rebinding Protection

A more subtle but common issue is DNS rebinding protection, a security feature in many modern routers and some public DNS services (like OpenDNS). Plex utilizes custom .plex.direct domains that resolve to local IP addresses to facilitate secure connections on the local network. DNS rebinding protection is designed to prevent this exact scenario, where a public DNS name points to a private, non-routable IP address, as it can be a vector for certain attacks.
Symptom: When this protection is active, attempts to connect to the server securely using its plex.direct address may fail, forcing apps to use an insecure local connection or a less efficient remote "Relay" connection.
Solution: The recommended solution is to configure the router or DNS service to add an exception for the plex.direct domain. For routers using dnsmasq, this can often be achieved by adding rebind-domain-ok=/plex.direct/ to the configuration.41 If the ISP's DNS is the source of the problem, switching the router's DNS servers to a different public provider (like Google Public DNS or Quad9) that does not perform this type of blocking can also resolve the issue.41
The following table outlines the essential network ports involved in local Plex operations.

Port
Protocol
Direction
Function
Required for this Project?
32400
TCP
Inbound to PMS
Main Plex Media Server API, web UI, and content streaming.14
Yes
32410, 32412, 32413, 32414
UDP
Inbound to PMS/Clients
G'Day Mate (GDM) network discovery.14
No (if using server roster method)
1900
UDP
Inbound to PMS
Plex DLNA Server discovery.14
No
5353
UDP
Inbound to PMS
Older Bonjour/Avahi network discovery.14
No
3005
TCP
Inbound to PMS
Plex Companion communication.42
Yes (Implicitly used by PMS)


6.2 Plex Server Settings: Secure Connections

Within the Plex Media Server settings, under Settings > Network, is a critical option titled Secure connections. The value of this setting can directly impact the ability of a custom application to control clients on the local network.9
Preferred (Default): This is the most compatible and highly recommended setting. It instructs the server to prefer secure (HTTPS) connections when available but to allow fallback to insecure (HTTP) connections from clients that do not support them or cannot establish a secure link.10 For a custom controller connecting directly to
http://{server_ip}:32400, this setting will work perfectly.
Required: This setting enforces HTTPS for all connections. If this is enabled, any attempt by the Controller to connect to the PMS via an insecure http:// URL will be rejected.9 To work with this setting, the Controller application must be capable of making HTTPS requests to the server's
plex.direct address and correctly handling its TLS certificate. This adds significant complexity and is generally not necessary for local network control.
Disabled: This setting forces all connections to be insecure. While it would allow the Controller to connect, it is strongly discouraged as it compromises the security of all Plex client interactions, especially over the internet.

6.3 A Comparative Look at Node.js Libraries

For developers working in a Node.js environment, the choice of library can significantly influence the development process. The landscape of available libraries reflects the evolution of the Plex API from a purely reverse-engineered entity to one with a more structured, albeit incomplete, specification.
plex-api (phillipj/node-plex-api): This is one of the original, foundational libraries for interacting with the PMS from Node.js.28 It provides a low-level interface for making
GET, POST, PUT, and DELETE requests to any API endpoint. It is powerful and flexible but requires the developer to manually construct the logic for complex operations like client control, including assembling all necessary headers and parameters.33 A significant consideration is that the package has not been updated in several years, meaning it may not support newer API features and has no active maintenance.33
node-plex-control: This library is a higher-level abstraction built specifically for the task of client control. It uses plex-api under the hood but exposes a much simpler, purpose-built interface with functions like playback.play() and navigation.moveUp().25 It handles the complexities of discovering the client and constructing the playback command internally. For a developer whose sole goal is client control, this library represents the most direct path to a working solution, despite also being unmaintained for some time.
@lukehagar/plexjs and Modern SDKs: This library represents the modern approach to API integration. It is a TypeScript SDK auto-generated from a community-maintained OpenAPI specification for the Plex API.24 This provides significant advantages, such as strong typing, broad coverage of the known API surface, and active maintenance. However, because the
playMedia command and the full Companion protocol are not part of the official, documented API, these modern SDKs may not have a simple, high-level function for this specific task. A developer using this library would leverage its primitives—such as getAvailableClients() and methods for searching the library—to gather the necessary identifiers and then would likely need to construct the final GET request manually, similar to using the base plex-api library.24
This evolution presents a trade-off. A developer can choose an older, unmaintained but purpose-built library like node-plex-control for a potentially faster initial implementation. Alternatively, they can opt for a modern, supported SDK like @lukehagar/plexjs for long-term project health and type safety, accepting that they may need to manually reconstruct the specific, undocumented control logic from its lower-level, well-defined components.

7.0 Conclusion: Synthesizing the Workflow and Future Considerations

The ability to programmatically control a Plex client from a custom application is a powerful feature that opens the door to a wide range of personalized media experiences. By deconstructing the Plex Companion protocol and leveraging the server-brokered communication model, developers can reliably initiate playback on devices like an AndroidTV. This report has provided a comprehensive, step-by-step guide to achieving this, from initial discovery to final command execution.

7.1 The Complete Path to Playback: A Recap

The recommended workflow, balancing reliability, simplicity, and compatibility with web technologies, can be summarized as follows:
Initialization: Instantiate a Plex API client in the Controller application, providing the Plex Media Server's local IP address and a valid X-Plex-Token for authentication.
Client Discovery: Send an authenticated GET request to the PMS /clients endpoint.
Client Identification: Parse the XML response from the /clients endpoint to locate the target AndroidTV client (e.g., by its name attribute) and extract its unique machineIdentifier, which will serve as the clientIdentifier.
Media Identification: Programmatically search the appropriate PMS library section (e.g., /library/sections/{id}/all) to find the desired media item and extract its unique integer ratingKey.
Server Identification: Send an authenticated GET request to the PMS /identity endpoint to retrieve the server's own unique machineIdentifier.
Command Execution: Construct and send a final, authenticated GET request to the /player/playback/playMedia endpoint on the PMS. This request must include all required HTTP headers (most importantly, X-Plex-Target-Client-Identifier pointing to the AndroidTV) and all required URL parameters (including the server's machineIdentifier and the media's key, constructed from its ratingKey).

7.2 The Fragility of Undocumented APIs

It must be re-emphasized that this entire workflow is built upon an API that is not officially documented or supported by Plex for third-party use. The methods and endpoints detailed in this report have been discovered and validated by the user community through meticulous reverse engineering and observation.6
This reliance creates an inherent fragility. Plex retains the right to modify, restrict, or remove these internal APIs in any future update to the Plex Media Server or client applications, and they would be under no obligation to provide notice or maintain backward compatibility. A developer building an application that depends on this functionality must do so with the understanding that it could break without warning.

7.3 Final Recommendations

Given the nature of the API, developers should adopt several best practices to mitigate risk and ensure the long-term viability of their application.
Implement Robust Error Handling: The Controller application's code should be designed to fail gracefully. It should anticipate and handle potential errors at every stage of the process, from a 404 Not Found when an endpoint is removed to a 401 Unauthorized if authentication methods change. Providing clear feedback to the user when a command fails is essential.
Isolate Plex-Specific Code: The logic for interacting with the Plex API should be encapsulated in a dedicated module or service within the application. This modular design will make it easier to update or replace the control logic if the underlying Plex API changes, without requiring a complete rewrite of the entire application.
Engage with the Community: The Plex developer community, primarily active on the official Plex forums and in various online groups, is the most valuable resource for staying informed about changes to the undocumented API. Monitoring these communities can provide early warnings of breaking changes and collaborative solutions to new challenges.
Despite the challenges and risks associated with its undocumented nature, the Plex API provides a remarkably powerful toolkit. For developers willing to navigate its obscurities, it offers the ability to move beyond simple media browsing and create truly interactive and custom-tailored integrations that significantly enrich the Plex experience.
Works cited
Support Articles | Plex Support, accessed August 3, 2025, https://support.plex.tv/articles/
Plex Companion Remote Control Issues, accessed August 3, 2025, https://support.plex.tv/articles/201812803-plex-companion-remote-control-issues/
Supported Plex Companion Apps, accessed August 3, 2025, https://support.plex.tv/articles/203082707-supported-plex-companion-apps/
Plex HTTP API - Development - Plex Forum, accessed August 3, 2025, https://forums.plex.tv/t/plex-http-api/45289
Plex API Documentation - Plexopedia, accessed August 3, 2025, https://www.plexopedia.com/plex-media-server/api/
Impossible to control plex locally via /player/playback endpoints, accessed August 3, 2025, https://forums.plex.tv/t/impossible-to-control-plex-locally-via-player-playback-endpoints/870187
Client HTTP API - Desktop Players - Plex Forum, accessed August 3, 2025, https://forums.plex.tv/t/client-http-api/119434
Allow remote control through PlexAPI · Issue #352 - GitHub, accessed August 3, 2025, https://github.com/pkkid/python-plexapi/issues/352
Network | Plex Support, accessed August 3, 2025, https://support.plex.tv/articles/200430283-network/
Suggested Plex Media Server Settings - TRaSH Guides, accessed August 3, 2025, https://trash-guides.info/Plex/Tips/Plex-media-server/
How do Plex clients find local servers? - Reddit, accessed August 3, 2025, https://www.reddit.com/r/PleX/comments/69gurp/how_do_plex_clients_find_local_servers/
Source code for plexapi.gdm, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/_modules/plexapi/gdm.html
Gdm plexapi.gdm — Python PlexAPI documentation - Read the Docs, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/modules/gdm.html
What network ports do I need to allow through my firewall? | Plex Support, accessed August 3, 2025, https://support.plex.tv/articles/201543147-what-network-ports-do-i-need-to-allow-through-my-firewall/
Hardening Plex Server: Network port direction? - Reddit, accessed August 3, 2025, https://www.reddit.com/r/PleX/comments/swneh0/hardening_plex_server_network_port_direction/
Make sure you open "discovery" ports in your PMS machine's local firewall : r/PleX - Reddit, accessed August 3, 2025, https://www.reddit.com/r/PleX/comments/axplci/make_sure_you_open_discovery_ports_in_your_pms/
Updated: Plex Media Servers Unwittingly Being Used In Amplified DDoS Attacks Warns Security Firm | HotHardware, accessed August 3, 2025, https://hothardware.com/news/plex-media-servers-unwittingly-being-used-in-global-ddos-attacks
Plex Media servers actively abused to amplify DDoS attacks - Bleeping Computer, accessed August 3, 2025, https://www.bleepingcomputer.com/news/security/plex-media-servers-actively-abused-to-amplify-ddos-attacks/
Plex media streaming service had some major security flaws - TechRadar, accessed August 3, 2025, https://www.techradar.com/news/plex-media-streaming-service-has-some-major-security-flaws
Plex Media SSDP (PMSSDP) Reflection/Amplification DDoS Attack Mitigation Recommendations | NETSCOUT, accessed August 3, 2025, https://www.netscout.com/blog/asert/plex-media-ssdp-pmssdp-reflectionamplification-ddos-attack
Python PlexAPI documentation - Read the Docs, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/introduction.html
Get Available Clients - Plex API Documentation, accessed August 3, 2025, https://plexapi.dev/api-reference/server/get-available-clients
plex-api-client - PyPI, accessed August 3, 2025, https://pypi.org/project/plex-api-client/
LukeHagar/plexjs: A Typescript SDK for interacting with Plex Media Server - GitHub, accessed August 3, 2025, https://github.com/LukeHagar/plexjs
phillipj/node-plex-control: Controlling Plex clients through ... - GitHub, accessed August 3, 2025, https://github.com/phillipj/node-plex-control
Plex API | Documentation | Postman API Network, accessed August 3, 2025, https://www.postman.com/fyvekatz/m-c-s-public-workspace/documentation/f2uw7pj/plex-api
MyPlex - Python PlexAPI - Read the Docs, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/modules/myplex.html
phillipj/node-plex-api: Node.js package used to query the ... - GitHub, accessed August 3, 2025, https://github.com/phillipj/node-plex-api
Get Server Identity - Plex API Documentation, accessed August 3, 2025, https://plexapi.dev/api-reference/server/get-server-identity
Server Identity - Plex API - Plexopedia, accessed August 3, 2025, https://www.plexopedia.com/plex-media-server/api/server/identity/
How to force a plex app on third party device to get the server identifier? [Highest level tech support; requires a project developer] - Reddit, accessed August 3, 2025, https://www.reddit.com/r/PleX/comments/177yh9f/how_to_force_a_plex_app_on_third_party_device_to/
Source code for plexapi.server, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/_modules/plexapi/server.html
plex-api - NPM, accessed August 3, 2025, https://www.npmjs.com/package/plex-api
Plex API: Get All Videos - Library - Plexopedia, accessed August 3, 2025, https://www.plexopedia.com/plex-media-server/api/library/videos/
Audio plexapi.audio — Python PlexAPI documentation, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/stable/modules/audio.html
plex-api-spec/src/pms-spec.yaml at main - GitHub, accessed August 3, 2025, https://github.com/LukeHagar/plex-api-spec/blob/main/src/pms-spec.yaml
Get Items Children - Plex API Documentation, accessed August 3, 2025, https://plexapi.dev/api-reference/library/get-items-children
Media - Python PlexAPI - Read the Docs, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/modules/media.html
Client plexapi.client — Python PlexAPI documentation, accessed August 3, 2025, https://python-plexapi.readthedocs.io/en/latest/modules/client.html
How to start a Plex stream using python-PlexAPI? - Stack Overflow, accessed August 3, 2025, https://stackoverflow.com/questions/68875959/how-to-start-a-plex-stream-using-python-plexapi
How to Use Secure Server Connections | Plex Support, accessed August 3, 2025, https://support.plex.tv/articles/206225077-how-to-use-secure-server-connections/
How to set up Plex Media server on Amazon LightSail - - Eternal Software Solutions, accessed August 3, 2025, https://www.eternalsoftsolutions.com/blog/how-to-set-up-plex-media-server-on-amazon-lightsail/
Kubernetes Part 14: Deploy Plexserver - Yaml with advanced networking, accessed August 3, 2025, https://www.debontonline.com/2021/01/part-14-deploy-plexserver-yaml-with.html
plex-api - Snyk Vulnerability Database, accessed August 3, 2025, https://security.snyk.io/package/npm/plex-api
