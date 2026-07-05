require('dotenv').config();
const { execSync } = require('child_process');

let deviceId = process.env.DEVICE_ID;

if (!deviceId) {
	deviceId = 'emulator-5554';
	console.error('❌ DEVICE_ID não definido no .env, usando dispositivo padrão: emulator-5554');
}

try {
	execSync(`adb -s ${ deviceId } reverse tcp:8081 tcp:8081`, { stdio: 'inherit' });
	console.log(`✅ Porta 8081 redirecionada com sucesso para o dispositivo ${ deviceId }`);
} catch (err) {
	console.error('❌ Erro ao executar o comando adb:', err.message);
	deviceId = 'emulator-5554';
	console.error('❌ Erro ao executar o comando adb, usando dispositivo padrão: emulator-5554');
	execSync(`adb -s ${ deviceId } reverse tcp:8081 tcp:8081`, { stdio: 'inherit' });
	process.exit(1);
}
