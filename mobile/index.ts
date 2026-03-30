import 'react-native-gesture-handler';
import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';

(globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;

import App from './App';

registerRootComponent(App);
