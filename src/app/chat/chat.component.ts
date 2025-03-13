import { FormsModule } from '@angular/forms';
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
  isLoading = false;  // Variable de estado para mostrar el cargando

  constructor(private http: HttpClient) {
    this.openai = new OpenAI({
       apiKey: '/', // Usa una variable de entorno
      dangerouslyAllowBrowser: true,
    });
  }

  async sendMessage() {
    if (this.userMessage.trim()) {
      this.messages.push({ sender: 'User', text: this.userMessage });
      this.isLoading = true; // Activamos el cargando mientras obtenemos la respuesta

      // Agregar un mensaje de carga
      this.messages.push({ sender: 'Chatbot', text: '🔄 Cargando...' });

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
          const updatedRun = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
          if (updatedRun.status === 'completed') {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Obtener la lista de mensajes del asistente
        const messagesResponse = await this.openai.beta.threads.messages.list(thread.id);

        const assistantMessages = messagesResponse.data.filter((msg) => msg.role === 'assistant');

        if (assistantMessages.length > 0) {
          const textContent = assistantMessages[0].content.find((c) => c.type === 'text');
          if (textContent && 'text' in textContent) {
            // Aquí agregamos la respuesta parcial del chatbot en streaming
            this.messages.push({
              sender: 'Chatbot',
              text: textContent.text.value as string,
            });
          } else {
            console.error('No se encontró contenido de texto válido en la respuesta');
            this.messages.push({
              sender: 'Chatbot',
              text: 'No pude generar una respuesta válida.',
            });
          }
        } else {
          console.error('No se encontraron mensajes del asistente.');
          this.messages.push({
            sender: 'Chatbot',
            text: 'No pude generar una respuesta válida.',
          });
        }
      } catch (error: unknown) {
        console.error('Error al obtener la respuesta:', error);
        let errorMessage = 'Ocurrió un error al procesar tu mensaje.';
        if (error instanceof Error) {
          errorMessage = `Error: ${error.message || 'Desconocido'}`;
        }
        this.messages.push({
          sender: 'Chatbot',
          text: errorMessage,
        });
      }

      // Desactivar el cargando
      this.isLoading = false;
      this.userMessage = '';
    }
  }

  // Función para gestionar la grabación de audio (sin cambios)
  startRecording() {
    if (this.isRecording) {
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
        this.stream?.getTracks().forEach(track => track.stop());
      }
      this.isRecording = false;
      return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          this.stream = stream;
          this.mediaRecorder = new MediaRecorder(stream);
          this.mediaRecorder.start();
          this.isRecording = true;

          this.mediaRecorder.ondataavailable = (event) => {
            const audioBlob = event.data;
            const audioUrl = URL.createObjectURL(audioBlob);

            this.messages.push({
              sender: 'User',
              audio: audioUrl,
            });
            this.sendVoiceResponse();
          };

          setTimeout(() => {
            if (this.mediaRecorder) {
              this.mediaRecorder.stop();
              this.stream?.getTracks().forEach(track => track.stop());
              this.isRecording = false;
            }
          }, 3000);
        })
        .catch(error => {
          console.error('Error al grabar audio:', error);
        });
    }
  }

  sendVoiceResponse() {
    const responseText = " Hola, no entendí";
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(responseText);
    utterance.pitch = 1;
    utterance.rate = 1;
    synth.speak(utterance);

    this.messages.push({
      sender: 'Chatbot',
      text: responseText,
      audio: null
    });
  }

  // Función para manejar la selección de imagen (sin cambios)
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.imagePreview = undefined;

      const formData = new FormData();
      formData.append('image', file, file.name);

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
        this.messages.push({ sender: 'User', text: '', image: this.imagePreview });

        this.http.post<any>(this.apiURL, formData).subscribe(
          (response) => {
            console.log('Respuesta de la clasificación de la imagen:', response);
            if (response && response.prediction && response.probability) {
              const prediction = response.prediction;
              const probability = (response.probability * 100).toFixed(2);
              this.messages.push({
                sender: 'Chatbot',
                text: `🔍 La imagen parece ser un **${prediction}** con una probabilidad del **${probability}%**`
              });
            } else {
              this.messages.push({
                sender: 'Chatbot',
                text: '❌ No se pudo clasificar la imagen correctamente. Intenta nuevamente.'
              });
            }
          },
          (error) => {
            console.error('Error al procesar la imagen:', error);
            this.messages.push({
              sender: 'Chatbot',
              text: `❌ Ocurrió un error al procesar la imagen. Error: ${error.message || 'Desconocido'}. Por favor, intenta de nuevo.`
            });
          }
        );
      };
      reader.readAsDataURL(file);
    } else {
      this.messages.push({
        sender: 'Chatbot',
        text: '❌ El archivo seleccionado no es una imagen. Por favor, intenta nuevamente con un archivo de imagen.'
      });
    }
  }
}
