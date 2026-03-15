# SettleUp

A cloud native expense splitting platform for small groups.

## Team
- Zuhao Zhang
- Lihao Xue
- Hao-Chih Huang
- George Cao

## Stack
- Web: React
- API: Node.js and Express
- Database: PostgreSQL
- Cache/queue: Redis
- Local development: Docker Compose
- Deployment: Kubernetes on DigitalOcean

## Local services
- web
- api
- db
- redis

## What has been done
- Created the GitHub repository and invited teammates
- Set up the base project folder structure
- Added the root Docker Compose setup
- Added the backend and frontend service skeletons
- Added PostgreSQL and Redis services
- Added the initial database schema
- Added environment variable template files
- Verified all services run locally
- Verified PostgreSQL data persists after restart
- Connected the API to PostgreSQL and Redis
- Added health and readiness endpoints
- Added basic user and group API routes

## TODO
- Add proper authentication and password hashing
- Add group membership management
- Add expense creation and split logic
- Add settlement and balance calculation
- Connect frontend to backend APIs
- Add Kubernetes deployment files
- Add monitoring and required advanced features
- Test the full system end to end
- Prepare presentation and report
