# Master Order

A comprehensive media management application that intelligently curates your next entertainment experience by integrating Plex libraries with external metadata sources like TVDB and ComicVine.

## Features

### Core Functionality
- **Smart Episode Selection**: Automatically selects the next unwatched episode from your TV series
- **Collection-Aware Ordering**: Identifies shared collections between movies and TV shows for chronological viewing
- **Multi-Source Integration**: Combines Plex library data with TVDB and ComicVine metadata
- **Custom Order Management**: Create and manage custom viewing orders for complex franchises
- **Real-time Artwork**: Dynamic artwork fetching and caching from TVDB

### Technical Stack
- **Frontend**: React with Vite, TailwindCSS
- **Backend**: Express.js with comprehensive API
- **Database**: SQLite with Prisma ORM
- **Integrations**: Plex Media Server, TVDB API, ComicVine API
- **Authentication**: Plex token-based authentication

## Architecture

### Frontend (`/client`)
- React application with modern hooks and context
- TailwindCSS for responsive design
- Real-time updates and loading states
- Artwork proxy and caching

### Backend (`/server`)
- Express.js RESTful API
- Prisma database layer with comprehensive models
- Service-oriented architecture:
  - `PlexSyncService`: Synchronizes Plex library data
  - `TvdbCachedService`: Manages TVDB API calls and caching
  - `ComicVineService`: Handles comic book metadata
  - `PlexDatabaseService`: Database abstraction layer

### Database Schema
- **Plex Models**: Movies, TV Shows, Seasons, Episodes, Libraries
- **TVDB Models**: Series, seasons, episodes with artwork caching
- **ComicVine Models**: Comics, series, volumes
- **Custom Models**: User-defined viewing orders and settings

## Setup and Installation

### Docker Installation (Recommended)

#### For Unraid Users
See [UNRAID_SETUP.md](UNRAID_SETUP.md) for detailed Unraid-specific instructions.

#### Quick Docker Setup
```bash
# Clone the repository
git clone https://github.com/your-username/master-order.git
cd master-order

# Build the Docker image
chmod +x build-docker.sh
./build-docker.sh

# Run with Docker Compose (recommended)
docker-compose up -d

# Or run manually
docker run -d \
  --name master-order \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/artwork-cache:/app/server/artwork-cache \
  -e PLEX_URL=http://your-plex-server:32400 \
  -e PLEX_TOKEN=your-plex-token \
  master-order:latest
```

### Manual Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Plex Media Server with accessible API
- TVDB API account (optional, for enhanced artwork)
- ComicVine API account (optional, for comic integration)

### Environment Variables
Create a `.env` file in the `/server` directory:

```env
DATABASE_URL="file:./prisma/dev.db"
PLEX_TOKEN="your-plex-token-here"
PLEX_URL="http://your-plex-server:32400"
TVDB_API_KEY="your-tvdb-api-key"
TVDB_BEARER_TOKEN="your-tvdb-bearer-token"
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd master-order
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client && npm install && cd ..
   
   # Install server dependencies
   cd server && npm install && cd ..
   ```

3. **Set up the database**
   ```bash
   cd server
   npx prisma migrate dev --name "initial_setup"
   npx prisma generate
   ```

4. **Configure your Plex connection**
   - Update the `.env` file with your Plex server details
   - Ensure your Plex server is accessible from the application

## Running the Application

### Development Mode
```bash
# Start both client and server concurrently
npm run dev

# Or start individually:
npm run client  # Frontend only (port 5173)
npm run server  # Backend only (port 3001)
```

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

### Core Functionality
- `GET /api/next-episode` - Get next episode recommendation
- `GET /api/next-movie` - Get next movie recommendation
- `GET /api/next-custom-order` - Get next item from custom order

### Settings Management
- `GET /api/settings` - Retrieve application settings
- `POST /api/settings` - Update application settings

### Plex Integration
- `POST /api/plex/sync` - Sync Plex library data
- `GET /api/plex/sync-status` - Check sync status
- `GET /api/search` - Search across Plex libraries

### TVDB Integration
- `GET /api/tvdb-artwork` - Proxy TVDB artwork requests
- `POST /api/tvdb/clear-cache` - Clear TVDB cache

## Configuration

### Collection Settings
Configure which Plex collection to use for episode selection in the Settings page.

### Order Type Percentages
Set the probability distribution for different content types:
- TV General: Random episodes from your collection
- Movies General: Random movies from your collection  
- Custom Order: Episodes from user-defined custom orders

## Development

### Database Migrations
```bash
cd server
npx prisma migrate dev --name "migration_description"
```

### Database Studio
```bash
cd server
npx prisma studio
```

### Testing
Various test scripts are available in the root directory for debugging different components.

## Troubleshooting

### Common Issues
- **Blank Page**: Check browser console for JavaScript errors
- **API Connection Errors**: Verify Plex server is running and accessible
- **Database Issues**: Run `npx prisma migrate reset` to reset the database
- **CORS Errors**: Ensure backend is running on port 3001

### Debug Scripts
- `test-plex-connection.js` - Test Plex API connectivity
- `test-tvdb-*.js` - Various TVDB integration tests
- `debug-*.js` - Debugging utilities for specific components

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Plex Media Server for the excellent media management platform
- TVDB for comprehensive TV show metadata
- ComicVine for comic book information
- The open-source community for the various libraries used
2. Install dependencies:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install
cd ..

# Install client dependencies
cd client && npm install
cd ..
```

### Running the Application

You can run both the frontend and backend together:

```bash
npm start
```

Or run them separately:

```bash
# Run the server
npm run server

# Run the client
npm run client
```

## API Endpoints

- `GET /api/test` - Returns a test message

## Future Enhancements

- Add user authentication
- Implement CRUD operations for orders
- Add more features and functionality

## Directory Structure

```
master-order/
├── client/             # React frontend
│   ├── public/         # Static files
│   └── src/            # React source code
│       ├── components/ # React components
│       └── styles/     # CSS styles
├── server/             # Express backend
│   ├── index.js        # Server entry point
│   └── masterorder.db  # SQLite database
└── start.js            # Script to start both client and server
```
