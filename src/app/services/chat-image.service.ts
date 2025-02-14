import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatImageService {

  private apiUrl: string = 'https://us-central1-gothic-calling-450712-s0.cloudfunctions.net/function-1';

  constructor(private http: HttpClient) {}

  // Función para clasificar la imagen
  classifyImage(image: File): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('file', image, image.name);

    return this.http.post<any>(this.apiUrl, formData, {
      headers: new HttpHeaders({
      }),
    });
  }

}
