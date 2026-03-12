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
