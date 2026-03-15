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
- Added the root Docker Compose setup
- Added the backend service skeleton
- Added the frontend service skeleton
- Added PostgreSQL and Redis services
- Added the initial database schema
- Added environment variable template files
- Verified all services run locally
- Verified PostgreSQL data persists after restart

## TODO
- Add authentication and user management
- Add group creation and member management
- Add expense creation and split logic
- Add settlement and balance calculation
- Connect frontend to backend APIs
- Add Kubernetes deployment files
- Add monitoring and required advanced features
- Test the full system end to end
- Prepare presentation and report
