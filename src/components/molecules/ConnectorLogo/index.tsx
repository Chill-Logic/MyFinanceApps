import { useState } from 'react';

import { BankConnectionUtils, type TBankConnection } from '@myfinance/shared';

import { cn } from '@/lib/utils';

interface IProps {
	connection: Pick<TBankConnection, 'connector_name' | 'connector_image_url' | 'connector_primary_color'>;
	className?: string;
}

/* "Nubank" → "Nu", "Itaú Unibanco" → "It". */
const initials = (name: string | null) => {
	const clean = (name || 'Banco').trim();
	return clean.slice(0, 2).replace(/^./, (letter) => letter.toUpperCase());
};

/*
 * Logo da instituição num círculo. Sem imagem (ou se ela falhar), as iniciais na cor da marca, como no mockup.
 * Tamanho pela `className` (ex.: `size-12`).
 */
const ConnectorLogo = ({ connection, className }: IProps) => {
	const [ failed, setFailed ] = useState(false);
	const brand_color = BankConnectionUtils.brandColor(connection);

	if (connection.connector_image_url && !failed) {
		return (
			<img
				src={connection.connector_image_url}
				alt=''
				onError={() => setFailed(true)}
				className={cn('size-12 shrink-0 rounded-full bg-white object-contain p-1.5', className)}
			/>
		);
	}

	return (
		<span
			aria-hidden='true'
			className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-foreground', className)}
			style={brand_color ? { backgroundColor: brand_color, color: '#fff' } : undefined}
		>
			{initials(connection.connector_name)}
		</span>
	);
};

export default ConnectorLogo;
