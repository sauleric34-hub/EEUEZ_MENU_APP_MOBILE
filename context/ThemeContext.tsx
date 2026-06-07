import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { COLORS } from '../constants/theme';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
    theme: ThemeType;
    isDark: boolean;
    colors: typeof COLORS.light;
    toggleTheme: () => void;
    setTheme: (t: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeType>('light');

    const colors = theme === 'dark' ? COLORS.dark : COLORS.light;
    const isDark = theme === 'dark';

    const toggleTheme = () => {
        setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    const setTheme = (t: ThemeType) => setThemeState(t);

    return (
        <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
