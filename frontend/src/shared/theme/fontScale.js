import { Platform } from "react-native";

// Font size that is larger on the web than on the phone: fs(webSize, phoneSize)
export const fs = (web, phone) => (Platform.OS === "web" ? web : phone);
