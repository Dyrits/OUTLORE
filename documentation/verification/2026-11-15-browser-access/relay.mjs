// node relay.mjs <port>: a relay on this computer, as the checks run one.
import { startNodeRelay } from "@outlore/relay";
const relay = await startNodeRelay({ port: Number(process.argv[2]) });
console.log(JSON.stringify({ ready: true, port: relay.port }));
setInterval(() => {}, 1 << 30);
