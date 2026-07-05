import React, { useEffect, useRef } from 'react';
import {
	View,
	Animated,
	DimensionValue,
} from 'react-native';

interface SkeletonProps {
	width?: DimensionValue;
	height?: DimensionValue;
	borderRadius?: number;
	margin?: number;
}

const Skeleton = ({ width, height, borderRadius }: SkeletonProps) => {
	const shimmerAnimation = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const startShimmerAnimation = () => {
			Animated.loop(
				Animated.timing(shimmerAnimation, {
					toValue: 1,
					duration: 1800,
					useNativeDriver: false,
				}),
			).start();
		};

		startShimmerAnimation();
	}, [ shimmerAnimation ]);

	const translateX = shimmerAnimation.interpolate({
		inputRange: [ 0, 1 ],
		outputRange: [ -400, 400 ],
	});

	return (
		<View
			style={{
				width: width || '100%',
				height: height || 40,
				backgroundColor: '#E0E0E0',
				borderRadius: borderRadius || 10,
				overflow: 'hidden',
			}}
		>
			<Animated.View
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: 'transparent',
					transform: [
						{
							translateX,
						},
					],
				}}
			>
				<View
					style={{
						width: 400,
						height: '100%',
						backgroundColor: 'transparent',
						position: 'relative',
					}}
				>
					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 30,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.05)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 40,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.08)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 50,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.12)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 60,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.16)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 70,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.22)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 80,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.28)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 90,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.35)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 100,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.45)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					{/* Centro brilhante */}
					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 110,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.6)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 120,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.45)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 130,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.35)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 140,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.28)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 150,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.22)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 160,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.16)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 170,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.12)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 180,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.08)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 190,
							width: 10,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.05)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					{/* Reflexo secundário muito sutil */}
					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 220,
							width: 15,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.03)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>

					<View
						style={{
							position: 'absolute',
							top: 0,
							left: 235,
							width: 15,
							height: '100%',
							backgroundColor: 'rgba(255, 255, 255, 0.02)',
							transform: [ { skewX: '-25deg' } ],
						}}
					/>
				</View>
			</Animated.View>
		</View>
	);
};

export default Skeleton;
