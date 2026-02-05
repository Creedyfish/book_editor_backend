<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
</p>

# Book Editor Backend

Backend API for the Book Editor project. Built using **NestJS** + **TypeScript** with Prisma ORM and automated tests.

## Overview

This repository implements the server-side of a book editing/management platform. It provides RESTful endpoints, database models, validation logic, and tests for core backend functionality. Main goals are maintainability, type safety, test coverage, and developer DX.

## Features

- Modular NestJS architecture
- CRUD APIs for core entities
- Database access via Prisma
- Environment config via `.env.sample`
- Unit and integration tests
- TypeScript builds with strict typing
- Linting & formatting configured

## Project Structure

```
book_editor_backend/
├── prisma/             # Prisma schema + migrations
├── src/                # Application source
│   ├── modules/        # Feature modules (e.g., books, users)
│   ├── main.ts         # App bootstrap
│   └── ...
├── test/               # Test suite (unit + e2e)
├── .env.sample         # Example env variables
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── README.md           # (this file)
└── package-lock.json
```

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** (comes with Node.js)
- **Database** (PostgreSQL/MySQL/SQLite supported based on config)

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/Creedyfish/book_editor_backend.git
cd book_editor_backend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Copy environment file:**

```bash
cp .env.sample .env
```

Configure your environment variables (`DATABASE_URL`, secrets, etc).

### Running Locally

**Development mode:**

```bash
npm run start:dev
```

**Production mode:**

```bash
npm run build
npm run start:prod
```

**Standard mode:**

```bash
npm run start
```

The server will typically start on `http://localhost:3000` (check your `.env` file for port configuration).

## Database

Ensure your database is running (PostgreSQL/MySQL/SQLite supported based on config).

**Run Prisma migrations:**

```bash
npx prisma migrate deploy
```

**Generate Prisma client (if needed):**

```bash
npx prisma generate
```

**Open Prisma Studio (database GUI):**

```bash
npx prisma studio
```

**Create a new migration:**

```bash
npx prisma migrate dev --name <migration-name>
```

**Reset database (development only):**

```bash
npx prisma migrate reset
```

## Scripts

| Command             | Purpose                |
| ------------------- | ---------------------- |
| `npm run start`     | Start server           |
| `npm run start:dev` | Run in watch mode      |
| `npm run build`     | Compile TS to JS       |
| `npm run lint`      | Lint code              |
| `npm test`          | Run tests              |
| `npm run test:cov`  | Generate test coverage |

## API Endpoints

Define your REST endpoints under `/src/modules/*`. Typical routes include:

```
GET    /api/books
POST   /api/books
GET    /api/books/:id
PATCH  /api/books/:id
DELETE /api/books/:id
```

_(Add additional routes based on your modules/controllers.)_

Once the server is running, API documentation may be available at:

- Swagger/OpenAPI: `http://localhost:3000/api` (if configured)

## Testing

**Run test suite:**

```bash
npm test
```

**Run e2e tests:**

```bash
npm run test:e2e
```

**Run coverage:**

```bash
npm run test:cov
```

## Tech Stack

- **NestJS** — Framework for scalable server apps
- **Prisma** — ORM for database modeling & querying
- **TypeScript** — Static typing
- **Jest** — Testing framework
- **ESLint / Prettier** — Code quality & formatting

## Environment

Use `.env.sample` to populate `.env`. Typical variables:

```env
DATABASE_URL=your_database_url
PORT=3000
JWT_SECRET=your_jwt_secret
```

## Code Quality

The project uses ESLint and Prettier for code quality and formatting:

```bash
# Run linter
npm run lint

# Format code (if configured)
npm run format
```

## Deployment

For production deployment:

1. Set up environment variables on your hosting platform
2. Build the application: `npm run build`
3. Run database migrations: `npx prisma migrate deploy`
4. Start the server: `npm run start:prod`

Consider using platforms like:

- [Heroku](https://heroku.com)
- [Railway](https://railway.app)
- [Render](https://render.com)
- [AWS](https://aws.amazon.com)
- [DigitalOcean](https://digitalocean.com)

For more details, check the [NestJS deployment documentation](https://docs.nestjs.com/deployment).

## Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Write code + tests
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Submit PR

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Discord](https://discord.gg/G7Qnnhy)

## License

Specify project license here.

## Support

If you encounter any issues or have questions:

- Open an issue on [GitHub](https://github.com/Creedyfish/book_editor_backend/issues)
- Check the [NestJS documentation](https://docs.nestjs.com)

## Author

**Creedyfish**

- GitHub: [@Creedyfish](https://github.com/Creedyfish)

---

Built with ❤️ using [NestJS](https://nestjs.com)
