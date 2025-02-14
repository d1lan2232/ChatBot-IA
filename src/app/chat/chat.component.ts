/*import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import OpenAI from 'openai';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export default class ChatComponent {
  messages: {
    sender: string;
    text?: string;
    image?: string | null;
    audio?: string | null;
  }[] = [];
  imagePreview: string | undefined = undefined;
  apiURL = '/api';
  userMessage: string = '';
  isRecording = false;
  mediaRecorder: MediaRecorder | null = null;
  stream: MediaStream | null = null;
  openai: OpenAI;

  constructor(private http: HttpClient) {
    this.openai = new OpenAI({
      apiKey:
        '', // Usa una variable de entorno
      dangerouslyAllowBrowser: true,
    });
  }

  async sendMessage() {
    if (this.userMessage.trim()) {
      this.messages.push({ sender: 'User', text: this.userMessage });

      try {
        const thread = await this.openai.beta.threads.create();
        await this.openai.beta.threads.messages.create(thread.id, {
          role: 'user',
          content: this.userMessage,
        });

        const run = await this.openai.beta.threads.runs.create(thread.id, {
          assistant_id: '',
        });

        // Esperamos hasta que la ejecución esté completada
        while (true) {
          const updatedRun = await this.openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
          );
          if (updatedRun.status === 'completed') {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Obtener la lista de mensajes del asistente
        const messagesResponse = await this.openai.beta.threads.messages.list(
          thread.id
        );
        console.log('Messages Response:', messagesResponse);

        const assistantMessages = messagesResponse.data.filter(
          (msg) => msg.role === 'assistant'
        );

        if (assistantMessages.length > 0) {
          const textContent = assistantMessages[0].content.find(
            (c) => c.type === 'text'
          );

          console.log('Text Content:', textContent);

          if (textContent && 'text' in textContent) {
            this.messages.push({
              sender: 'Chatbot',
              text: textContent.text.value,
            });
          } else {
            console.error(' No se encontró contenido de texto válido en la respuesta');
            this.messages.push({
              sender: 'Chatbot',
              text: ' No pude generar una respuesta válida.',
            });
          }
        } else {
          console.error('No se encontraron mensajes del asistente.');
          this.messages.push({
            sender: 'Chatbot',
            text: ' No pude generar una respuesta válida.',
          });
        }
      } catch (error: unknown) {
        console.error(' Error al obtener la respuesta:', error);
        let errorMessage = ' Ocurrió un error al procesar tu mensaje.';

        if (error instanceof Error) {
          errorMessage = `Error: ${error.message || 'Desconocido'}`;
        }

        this.messages.push({
          sender: 'Chatbot',
          text: errorMessage,
        });
      }

      this.userMessage = '';
    }
  }



  
  startRecording() {
    if (this.isRecording) {
      // Detener la grabación si ya estamos grabando
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
        this.stream?.getTracks().forEach(track => track.stop()); // Detener el stream
      }
      this.isRecording = false; // Cambiar el estado a no grabando
      return;
    }

    // Si no estamos grabando, iniciar la grabación
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          this.stream = stream; // Guardar el stream
          this.mediaRecorder = new MediaRecorder(stream); // Crear una nueva instancia de MediaRecorder
          this.mediaRecorder.start();
          this.isRecording = true; // Cambiar el estado a grabando

          // Cuando se tenga datos disponibles, crear la URL del audio
          this.mediaRecorder.ondataavailable = (event) => {
            const audioBlob = event.data;
            const audioUrl = URL.createObjectURL(audioBlob); // Crear la URL para reproducir el audio

            // Agregar solo el audio sin texto
            this.messages.push({
              sender: 'User',
              audio: audioUrl // Guardar la URL del audio en el mensaje
            });
            console.log('Audio URL:', audioUrl);

            // Aquí agregamos la función para que el chatbot responda con voz después de que el usuario envía un mensaje de voz.
            this.sendVoiceResponse();
          };

          setTimeout(() => {
            if (this.mediaRecorder) {
              this.mediaRecorder.stop();
              this.stream?.getTracks().forEach(track => track.stop()); // Detener el stream automáticamente después de 3 segundos
              this.isRecording = false; // Cambiar el estado a no grabando
            }
          }, 3000); // Graba por 3 segundos
        })
        .catch(error => {
          console.error(' Error al grabar audio:', error);
        });
    } else {
      console.error(' El navegador no soporta grabación de audio.');
    }
  }

  sendVoiceResponse() {
    // Simulamos una respuesta del chatbot en voz
    const responseText = " Hola, ¿En que te puedo ayudar el día de hoy?";

    // Usamos la API de SpeechSynthesis para que el chatbot hable
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(responseText);

    // Opcional: configurar la voz y la velocidad del speech
    utterance.pitch = 1; // Tono de voz
    utterance.rate = 1; // Velocidad de la voz

    // Reproducir la voz
    synth.speak(utterance);

    // Agregar el mensaje del chatbot con el texto
    this.messages.push({
      sender: 'Chatbot',
      text: responseText,
      audio: null // El chatbot responde con un mensaje de texto (aunque también puede ser de voz)
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];

    if (file && file.type.startsWith('image/')) {
      // Limpiar la vista previa de la imagen previa
      this.imagePreview = undefined;

      // Crear un FormData para enviar la imagen
      const formData = new FormData();
      formData.append('image', file, file.name);

      // Crear una URL para previsualizar la imagen
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string; // Establecer la nueva vista previa
        // Agregar solo la imagen (sin mensaje de texto) al array de mensajes
        this.messages.push({ sender: 'User', text: '', image: this.imagePreview });

        // Realizar la solicitud POST al backend para clasificar la imagen
        this.http.post<any>(this.apiURL, formData).subscribe(
          (response) => {
            console.log(' Respuesta de la clasificación de la imagen:', response);
            if (response && response.prediction && response.probability) {
              const prediction = response.prediction;
              const probability = (response.probability * 100).toFixed(2); // Convertir a porcentaje

              // Agregar la predicción correspondiente al mensaje
              this.messages.push({
                sender: 'Chatbot',
                text: ` 🔍 La imagen parece ser un **${prediction}** con una probabilidad del **${probability}%**`
              });
            } else {
              this.messages.push({
                sender: 'Chatbot',
                text: ' ❌ No se pudo clasificar la imagen correctamente. Intenta nuevamente.'
              });
            }
          },
          (error) => {
            console.error('Error al procesar la imagen:', error);
            this.messages.push({
              sender: 'Chatbot',
              text: ` ❌ Ocurrió un error al procesar la imagen. Error: ${error.message || 'Desconocido'}. Por favor, intenta de nuevo.`
            });
          }
        );
      };
      reader.readAsDataURL(file); // Leer la imagen y generar la URL
    } else {
      this.messages.push({
        sender: 'Chatbot',
        text: ' ❌ El archivo seleccionado no es una imagen. Por favor, intenta nuevamente con un archivo de imagen.'
      });
    }
  }

  //habilitar por el enter
  onKeydown(event: KeyboardEvent){
  
    if(event.key === 'Enter'){
      this.sendMessage();

      return;
    }


  }

}
*/