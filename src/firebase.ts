import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCbjIXqHsKuV2DS5XE3T1QccHHMErcevTo",
  authDomain: "adn-employee-management-system.firebaseapp.com",
  projectId: "adn-employee-management-system",
  storageBucket: "adn-employee-management-system.firebasestorage.app",
  messagingSenderId: "68607690053",
  appId: "1:68607690053:web:4ceb25af81a80179b8aa2c",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_EMAIL = "adn.semicon@gmail.com";
