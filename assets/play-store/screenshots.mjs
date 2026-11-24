// Prints da Play: Chrome headless + DevTools Protocol, celular 360x640 a 3x (= 1080x1920), conta de demonstração.
// Uso (Node 22+, app em http://localhost:5173 e API local em :3010 com a conta do seed_demo.py):
//   DEMO_PASSWORD=... node screenshots.mjs <pasta de saída> [só-este-print]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const OUT = process.argv[2];
const APP = 'http://localhost:5173';
const API = 'http://localhost:3010/v1';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const { data: { token } } = await (await fetch(`${ API }/auth/sign_in`, {
	method: 'POST', headers: { 'X-API-Key': 'local-dev-token', 'Content-Type': 'application/json' },
	body: JSON.stringify({ email: 'demo@myfinance.app.br', password: process.env.DEMO_PASSWORD }),
})).json();

const chrome = spawn(CHROME, [ '--headless=new', `--remote-debugging-port=${ PORT }`, `--user-data-dir=${ path.join(tmpdir(), 'myfinance-screenshots-profile') }`,
	'--hide-scrollbars', '--no-first-run', '--window-size=360,640', 'about:blank' ], { stdio: 'ignore' });

let targets;
for (let i = 0; i < 40; i++) {
	try { targets = await (await fetch(`http://127.0.0.1:${ PORT }/json`)).json(); if (targets.length) break; } catch { /* ainda subindo */ }
	await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
	const msg = JSON.parse(event.data);
	if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setEmulatedMedia', { features: [ { name: 'prefers-color-scheme', value: 'dark' } ] });
await send('Page.navigate', { url: `${ APP }/entrar` });
await sleep(4000);
await evaluate(`localStorage.setItem('my-finance-token', ${ JSON.stringify(token) }); localStorage.setItem('theme-preference', 'dark'); true`);

const waitLoaded = async () => {
	await sleep(1500);
	for (let i = 0; i < 120; i++) {
		const { result } = await evaluate(`document.querySelectorAll('.animate-pulse, .animate-spin').length`);
		if (result.result.value === 0) break;
		await sleep(500);
	}
	await sleep(2500);
};

const SHOTS = [
	[ '1-inicio', '/' ],
	[ '2-contas', '/contas' ],
	[ '3-cartoes', '/contas?aba=cartoes' ],
	[ '4-nova-transacao', '/', 'form' ],
	[ '5-recorrencias', '/contas?aba=recorrencias' ],
	[ '6-carteiras', '/carteiras' ],
];
for (const [ name, url, action ] of SHOTS.filter(([ n ]) => !process.argv[3] || n === process.argv[3])) {
	await send('Page.navigate', { url: `${ APP }${ url }` });
	await waitLoaded();
	if (url === '/' || url === '/carteiras') await sleep(8000);
	if (action === 'form') {
		await evaluate(`document.querySelector('nav[aria-label="Navegação principal"] button[aria-label*="ransa"]')?.click()`);
		await sleep(2500);
		await send('Input.insertText', { text: '18790' });
		await evaluate(`document.querySelector('[role="dialog"] input[placeholder*="escri"], [role="dialog"] textarea[placeholder*="escri"]')?.focus()`);
		await send('Input.insertText', { text: 'Mercado do mês' });
		await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes('Escolher origem'))?.click()`);
		await sleep(1200);
		await evaluate(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] button')].find((b) => b.textContent.trim().startsWith('Nubank'))?.click()`);
		await sleep(1200);
		await evaluate(`document.activeElement?.blur()`);
		await sleep(800);
	}
	const { result } = await send('Page.captureScreenshot', { format: 'png' });
	writeFileSync(path.join(OUT, `${ name }.png`), Buffer.from(result.data, 'base64'));
	console.log(name);
}
ws.close();
chrome.kill();
