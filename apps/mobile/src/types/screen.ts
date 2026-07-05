import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export interface IScreenProps<T extends string> {
	navigation: NativeStackNavigationProp<any, T>;
}

export type TStackParam = {
	name: string;
	component: React.ComponentType<any>;
}
