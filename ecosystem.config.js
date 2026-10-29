module.exports = {
  apps: [
    {
      name: "siymon-server",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // Restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      // Keep logs in ./logs (also streamed to stdout for Docker/PM2)
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      time: true,
    },
  ],
};
