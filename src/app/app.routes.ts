import { Routes } from '@angular/router';

export const routes: Routes = [
  {path:'chatbot',loadComponent:()=>import('./chat/chat.component')},
  {path:'**',
    redirectTo:'chatbot'
  },

];
