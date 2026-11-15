pkill -f "dist/main.js --remote-debugging-port=9377"; sleep 2
rm -rf /tmp/outlore-demo/data; mkdir -p /tmp/outlore-demo/data
cd "${OUTLORE_REPO:?Set OUTLORE_REPO to the repository root}/apps/desktop"
bun run build >/dev/null 2>&1 || echo BUILD FAILED
ZDOTDIR=/tmp/outlore-demo/zdot OUTLORE_DEMO_SHELL=/bin/zsh OUTLORE_DEMO_SCRIPT=/tmp/outlore-demo/demo.json OUTLORE_HARNESS=fake OUTLORE_DATA_DIR=/tmp/outlore-demo/data OUTLORE_APP_URL=http://localhost:8123 nohup ../../node_modules/.bin/electron dist/main.js --remote-debugging-port=9377 > /tmp/outlore-demo/electron.log 2>&1 &
for i in $(seq 1 60); do curl -s http://127.0.0.1:9377/json >/dev/null && break; sleep 1; done; sleep 6; echo up
