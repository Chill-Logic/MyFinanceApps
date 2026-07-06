const { withGradleProperties } = require('@expo/config-plugins');

// O template padrao do prebuild configura -Xmx2048m -XX:MaxMetaspaceSize=512m, que estoura
// (OutOfMemoryError: Metaspace) processando o KSP do expo-updates. Sem esse plugin, o valor
// voltaria ao padrao a cada `expo prebuild`, ja que android/gradle.properties nao e versionado.
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

module.exports = function withGradleJvmArgs(config) {
	return withGradleProperties(config, (modConfig) => {
		const key = 'org.gradle.jvmargs';
		const existing = modConfig.modResults.find((item) => item.type === 'property' && item.key === key);

		if (existing) {
			existing.value = JVM_ARGS;
		} else {
			modConfig.modResults.push({ type: 'property', key, value: JVM_ARGS });
		}

		return modConfig;
	});
};
