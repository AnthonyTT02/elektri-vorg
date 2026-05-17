const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.entries(meta)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      return `[${level.toUpperCase()}] ts=${timestamp} service=elektri-vorg ${metaStr} message="${message}"`;
    })
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
