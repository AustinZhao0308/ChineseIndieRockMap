# Interactive China Music Map

A modern, interactive web application that visualizes local bands and music scenes across different provinces in China. Built with React, D3.js, and Tailwind CSS, this project features a highly responsive and atmospheric dark-mode map interface.

## ✨ Features

- **Interactive SVG Map**: Custom-rendered map of China using native SVG and `d3-geo`, ensuring high performance and crisp rendering at any scale.
- **Smooth Navigation**: Fluid zooming and panning mechanics powered by `d3-zoom` and `d3-transition`.
- **Data Visualization**: Highlights provinces with active music scenes and displays detailed band information upon interaction.
- **Responsive Design**: Automatically adjusts map centering, zoom levels, and layout offsets for both desktop and mobile devices.
- **Atmospheric UI**: A sleek, dark-themed interface with radial gradients and modern typography.

## 🛠️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Map & Visualization**: [D3.js](https://d3js.org/) (`d3-geo`, `d3-zoom`, `d3-selection`, `d3-transition`)
- **Animations**: [Framer Motion](https://motion.dev/)

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository and navigate to the project directory.
2. Install the dependencies:

```bash
npm install
```

### Development Server

Start the local development server:

```bash
npm run dev
```

Open your browser and visit `http://localhost:3000` to view the application.

## 📦 Build for Production

To create a production-ready build:

```bash
npm run build
```

The built files will be output to the `dist` directory.

## Production deployment

The server runs the Express API and serves `dist` when started with `npm start`. Keep its runtime configuration in a server-only `.env` file; do not commit it.

```bash
NODE_ENV=production
ADMIN_USERNAME=catbeer_admin
ADMIN_DISPLAY_NAME=Catbeer Admin
ADMIN_PASSWORD_HASH=<a unique bcrypt hash>
JWT_SECRET=<keep the current map secret, or generate a 32-plus-character secret>
USER_JWT_SECRET=<a different 32-plus-character secret>
APPLE_CLIENT_ID=com.catbeer.Catbeer-iOS
DATABASE_PATH=/var/lib/chinese-indie-rock-map/bands.db
```

Generate a bcrypt hash for the fallback administrator password with:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(console.log)" 'choose-a-strong-password'
```

`JWT_SECRET` signs existing map admin and partner sessions, so preserve its current production value during an upgrade unless you intentionally want to invalidate those sessions. `USER_JWT_SECRET` is separate for Catbeer app users. Apple sign-in requires the same bundle identifier in Apple Developer and `APPLE_CLIENT_ID`.

On the Aliyun host, back up the SQLite database, update the server-only `.env`, then run the deployment script:

```bash
mkdir -p backups
cp /var/lib/chinese-indie-rock-map/bands.db backups/bands-$(date +%F-%H%M%S).db
./deploy.sh
```

`deploy.sh` builds first, validates the production configuration without printing secrets, and only then reloads the existing `map` PM2 process. The Catbeer tables and API routes are additive; existing map pages and data are not migrated or replaced.
