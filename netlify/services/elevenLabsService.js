const axios = require('axios');
const FormData = require('form-data');

class ElevenLabsService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.defaultVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
  }

  /**
   * Convert speech to text
   */
  async speechToText(audioBuffer) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm'
      });

      const response = await axios.post(
        `${this.baseUrl}/speech-to-text`,
        formData,
        {
          headers: {
            'xi-api-key': this.apiKey,
            ...formData.getHeaders()
          }
        }
      );

      console.log('✓ ElevenLabs STT complete');
      return response.data.text;

    } catch (error) {
      console.error('ElevenLabs STT error:', error.response?.data || error.message);
      throw new Error('Failed to convert speech to text');
    }
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(text, voiceId = null) {
    try {
      const voice = voiceId || this.defaultVoiceId;

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voice}`,
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      console.log('✓ ElevenLabs TTS complete');
      return Buffer.from(response.data);

    } catch (error) {
      console.error('ElevenLabs TTS error:', error.response?.data || error.message);
      throw new Error('Failed to convert text to speech');
    }
  }

  /**
   * List available voices
   */
  async getVoices() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/voices`,
        {
          headers: {
            'xi-api-key': this.apiKey
          }
        }
      );

      return response.data.voices;
    } catch (error) {
      console.error('Failed to fetch voices:', error.message);
      return [];
    }
  }
}

module.exports = ElevenLabsService;
