export const TextUtils = {
	truncate: ({ text, maxLength = 30, suffix = '...' }: { text: string; maxLength?: number; suffix?: string }): string => {
		if (!text || text.length <= maxLength) {
			return text;
		}

		return text.substring(0, maxLength - suffix.length) + suffix;
	},
};
