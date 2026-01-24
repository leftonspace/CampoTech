declare module '@expo/vector-icons' {
    import { ComponentType } from 'react';
    import { TextProps } from 'react-native';

    export interface IconProps extends TextProps {
        name: string;
        size?: number;
        color?: string;
    }

    export const Feather: ComponentType<IconProps>;
    export const MaterialIcons: ComponentType<IconProps>;
    export const Ionicons: ComponentType<IconProps>;
    export const FontAwesome: ComponentType<IconProps>;
    export const MaterialCommunityIcons: ComponentType<IconProps>;
    export const AntDesign: ComponentType<IconProps>;
    export const Entypo: ComponentType<IconProps>;
}
