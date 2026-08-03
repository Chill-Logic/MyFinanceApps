import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors } from '@myfinance/shared';

import { useTheme } from '../../../context/theme';

import { ThemedText } from '../ThemedText';

export type TSegment = {
	value: string;
	label: string;
	icon?: string;
};

type TSegmentedControlProps = {
	segments: TSegment[];
	value: string;
	onChange: (value: string)=> void;
};

const TRACK_PADDING = 4;

/**
 * Segmented control com "thumb" (a pílula do item ativo) que DESLIZA entre os segmentos em vez de
 * saltar — o thumb é um `Animated.View` posicionado absolutamente, animado por `translateX` (driver
 * nativo). Largura de cada segmento medida via `onLayout` (são de largura igual, `flex: 1`, sem gap
 * entre eles, então `translateX = índice * largura_do_segmento` cai exato no lugar).
 */
const SegmentedControl = ({ segments, value, onChange }: TSegmentedControlProps) => {
	const { theme } = useTheme();
	const [ track_width, setTrackWidth ] = useState(0);
	const translate = useRef(new Animated.Value(0)).current;

	const active_index = Math.max(0, segments.findIndex((segment) => segment.value === value));
	const segment_width = track_width > 0 ? (track_width - TRACK_PADDING * 2) / segments.length : 0;

	useEffect(() => {
		Animated.timing(translate, {
			toValue: active_index * segment_width,
			duration: 200,
			useNativeDriver: true,
		}).start();
	}, [ active_index, segment_width, translate ]);

	const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

	return (
		<View style={styles.track} onLayout={onLayout}>
			{segment_width > 0 && (
				<Animated.View
					style={[ styles.thumb, { width: segment_width, transform: [ { translateX: translate } ] } ]}
				/>
			)}

			{segments.map((segment) => {
				const active = segment.value === value;
				const item_color = active ? '#fff' : theme.colors.placeholder;

				return (
					<TouchableOpacity
						key={segment.value}
						style={styles.segment}
						onPress={() => onChange(segment.value)}
						activeOpacity={0.8}
					>
						{segment.icon && <Icon name={segment.icon as never} size={16} color={item_color} />}
						<ThemedText style={[ styles.label, { color: item_color }, active && styles.labelActive ]}>{segment.label}</ThemedText>
					</TouchableOpacity>
				);
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	track: {
		flexDirection: 'row',
		padding: TRACK_PADDING,
		borderRadius: 10,
		backgroundColor: 'rgba(255, 255, 255, 0.06)',
		position: 'relative',
	},
	thumb: {
		position: 'absolute',
		top: TRACK_PADDING,
		bottom: TRACK_PADDING,
		left: TRACK_PADDING,
		borderRadius: 7,
		backgroundColor: colors['brand-secondary'],
	},
	segment: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 7,
		zIndex: 1,
	},
	label: {
		fontSize: 13,
	},
	labelActive: {
		fontWeight: '600',
	},
});

export default SegmentedControl;
