module.exports = {
  apps: [
    {
      name: "watch-commander-backend",
      cwd: "/Users/johncooper/watch-commander-ops-hub/backend",
      script: "encore",
      args: "run",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        PATH: process.env.PATH,
      },
    },
    {
      name: "watch-commander-frontend",
      cwd: "/Users/johncooper/watch-commander-ops-hub/frontend",
      script: "/Users/johncooper/.bun/bin/bunx",
      args: "vite --host 127.0.0.1",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 2000,
      env: {
        PATH: process.env.PATH,
      },
    },
  ],
};
