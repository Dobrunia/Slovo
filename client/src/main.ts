import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { pinia } from "./stores/pinia";
import "dobruniaui-vue/styles.css";
import "./tokens.css";

createApp(App).use(pinia).use(router).mount("#app");
