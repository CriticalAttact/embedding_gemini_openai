import winston from "winston";

const getLogger = (label) => {
    return winston.createLogger({
        format: winston.format.combine(
            winston.format.colorize({
                all: true,
            }),
            winston.format.timestamp(),
            winston.format.json(),
            winston.format.label({
                label: label,
            }),
            winston.format.printf((json) => {
                return `${new Date().toLocaleTimeString("it-IT")} - [^_^]: ${json.message
                    }`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({
                level: "info",
                filename: "./logs/data-err.log",
            }),
        ],
    });
};

const logger = getLogger();

export {
    getLogger,
    logger,
};