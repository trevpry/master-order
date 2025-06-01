# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

## Scopes
- **client**: Frontend React application
- **server**: Backend Express application
- **db**: Database schema or migrations
- **plex**: Plex integration features
- **tvdb**: TVDB integration features
- **comicvine**: ComicVine integration features
- **api**: API endpoints and routes
- **ui**: User interface components
- **config**: Configuration files

## Examples
```
feat(plex): add comprehensive field syncing for episodes
fix(client): resolve artwork loading issue
docs: update API documentation
refactor(server): reorganize service layer structure
chore(deps): update dependencies to latest versions
```
