import { useState, useRef, useEffect, FC } from 'react';
import { Send } from 'lucide-react';
import QRCode from 'react-qr-code';

interface Message {
  text?: string;
  component?: JSX.Element;
  isBot: boolean;
  isAdvanced?: boolean;
}

interface BookingState {
  step: string;
  museum: string;
  date: string;
  timeSlot: string;
  tickets: number;
  userId: string;
}

const availabilityData = [
  { museum: 'The Louvre', date: '2024-09-15', timeSlot: '10:00', availableTickets: 5 },
  { museum: 'The Louvre', date: '2024-09-15', timeSlot: '12:00', availableTickets: 0 },
  { museum: 'The British Museum', date: '2024-09-15', timeSlot: '14:00', availableTickets: 10 },
  { museum: 'The Metropolitan Museum of Art', date: '2024-09-17', timeSlot: '03:00 PM', availableTickets: 3 },
  { museum: 'The Metropolitan Museum of Art', date: '2024-09-17', timeSlot: '11:00 AM', availableTickets: 2 },
];

const MuseumChatbot: FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { text: "Welcome to the Museum Information and Reservation System! I'm here to help you book your visit or answer any questions you may have. Would you like to make a reservation or ask a question?", isBot: true }
  ]);
  const [input, setInput] = useState<string>('');
  const [bookingState, setBookingState] = useState<BookingState>({
    step: 'initial',
    museum: '',
    date: '',
    timeSlot: '',
    tickets: 0,
    userId: Math.random().toString(36).substr(2, 9),
  });
  const [isAdvancedChatbot, setIsAdvancedChatbot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (input.trim() === '') return;
    setMessages(prev => [...prev, { text: input, isBot: false }]);
    setInput('');
    if (isAdvancedChatbot) {
      handleAdvancedChatbotQuery(input);
    } else {
      processUserInput(input);
    }
  };

  const botReply = (text: string, isAdvanced: boolean = false) => {
    setMessages(prev => [...prev, { text, isBot: true, isAdvanced }]);
  };

  const processUserInput = async (userInput: string) => {
    const lowerInput = userInput.toLowerCase();

    switch (bookingState.step) {
      case 'initial':
        if (lowerInput.includes('reservation') || lowerInput.includes('book') || lowerInput.includes('ticket')) {
          setBookingState(prev => ({ ...prev, step: 'museum' }));
          botReply("Great! Which museum would you like to visit? We have the Louvre, Metropolitan Museum of Art, British Museum, and National Gallery available.");
        } else {
          botReply("It seems like you have a question that might require more detailed information. Would you like to switch to our advanced FAQ chatbot? (Yes/No)", true);
          setBookingState(prev => ({ ...prev, step: 'switch_to_advanced' }));
        }
        break;

      case 'switch_to_advanced':
        if (lowerInput.includes('yes') || lowerInput.includes('sure') || lowerInput.includes('ok') || lowerInput.includes('yeah')) {
          setIsAdvancedChatbot(true);
          botReply("Great! You're now connected to our advanced FAQ chatbot. How can I assist you today?", true);
        } else {
          setBookingState(prev => ({ ...prev, step: 'museum' }));
          botReply("Alright, let's continue with the reservation process. Which museum would you like to visit?");
        }
        break;

      case 'museum':
        const museums = ['louvre', 'metropolitan museum of art', 'british museum', 'national gallery'];
        const foundMuseum = museums.find(museum => lowerInput.includes(museum));
        if (foundMuseum) {
          setBookingState(prev => ({ ...prev, museum: foundMuseum, step: 'date' }));
          botReply(`Excellent choice! The ${foundMuseum} is a fantastic museum. What date would you like to visit? (Please use the format MM/DD/YYYY)`);
        } else {
          botReply("I'm sorry, I didn't recognize that museum. Could you please choose from the Louvre, Metropolitan Museum of Art, British Museum, or National Gallery?");
        }
        break;

      case 'date':
        const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/;
        const dateMatch = lowerInput.match(dateRegex);
        if (dateMatch) {
          setBookingState(prev => ({ ...prev, date: dateMatch[0], step: 'time' }));
          botReply(`Got it, you'd like to visit on ${dateMatch[0]}. What time would you prefer? We have slots available every hour from 9:00 AM to 4:00 PM.`);
        } else {
          botReply("I'm sorry, I couldn't understand that date. Could you please provide it in the format MM/DD/YYYY?");
        }
        break;

        case 'time':
          const timeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
          const timeMatch = lowerInput.match(timeRegex);
        
          if (timeMatch) {
            const requestedTimeStr = timeMatch[0].toLowerCase().trim();
            
            const currentDate = new Date();
            const requestedTime = new Date(currentDate);
            const [time, period] = requestedTimeStr.split(/\s*(am|pm)\s*/);
            const [hours, minutes = 0] = time.split(':').map(Number);
        
            requestedTime.setHours(period === 'pm' && hours !== 12 ? hours + 12 : hours === 12 && period === 'am' ? 0 : hours);
            requestedTime.setMinutes(minutes);
        
            const startTime = new Date(currentDate);
            startTime.setHours(9, 0, 0); // 9:00 AM
        
            const endTime = new Date(currentDate);
            endTime.setHours(16, 0, 0); // 4:00 PM
        
            if (requestedTime >= startTime && requestedTime <= endTime) {
              try {
                const availableTickets = 5;
        
                if (availableTickets > 0) {
                  setBookingState(prev => ({ ...prev, timeSlot: requestedTimeStr, step: 'tickets' }));
                  botReply(`Great! We have tickets available for ${requestedTimeStr}. How many tickets would you like to book?`);
                } else {
                  const nextAvailableSlot = await findNextAvailableSlot(bookingState.museum, bookingState.date, requestedTimeStr);
                  if (nextAvailableSlot) {
                    botReply(`I'm sorry, but the ${requestedTimeStr} slot is not available. The next available slot is at ${nextAvailableSlot}. Would you like to book for this time instead? (Yes/No)`);
                    setBookingState(prev => ({ ...prev, step: 'alternate_time', timeSlot: nextAvailableSlot }));
                  } else {
                    botReply(`I'm sorry, but there are no available slots for the rest of the day. Would you like to try a different date? (Yes/No)`);
                    setBookingState(prev => ({ ...prev, step: 'retry_date' }));
                  }
                }
              } catch (error) {
                console.error('Error checking availability:', error);
                botReply("I'm sorry, but there was an error checking availability. Please try again later.");
              }
            } else {
              botReply("Please select a time between 9:00 AM and 4:00 PM.");
            }
          } else {
            botReply("I'm sorry, I couldn't understand that time. Could you please specify a time between 9:00 AM and 4:00 PM?");
          }
          break;
        

      case 'tickets':
        const ticketRegex = /(\d+)/;
        const ticketMatch = lowerInput.match(ticketRegex);
        if (ticketMatch) {
          const tickets = parseInt(ticketMatch[0]);
          setBookingState(prev => ({ ...prev, tickets, step: 'confirm' }));
          botReply(`Great! I've noted that you want ${tickets} ticket(s). Here's a summary of your booking:
          
Museum: ${bookingState.museum}
Date: ${bookingState.date}
Time: ${bookingState.timeSlot}
Tickets: ${tickets}

Is this correct? (Please respond with Yes or No)`);
        } else {
          botReply("I'm sorry, I couldn't understand the number of tickets. Could you please provide a number?");
        }
        break;

      case 'confirm':
        if (lowerInput.includes('yes')) {
          try {
            const success = await bookTickets(bookingState.userId, bookingState.museum, bookingState.date, bookingState.timeSlot, bookingState.tickets);

            if (success) {
              setBookingState(prev => ({ ...prev, step: 'complete' }));
              botReply("Wonderful! Your reservation is confirmed. You can now download your ticket:");
              generateTicketDownloadLink();
            } else {
              botReply("I apologize, but there was an error processing your reservation. Please try again later.");
              setBookingState(prev => ({ ...prev, step: 'initial' }));
            }
          } catch (error) {
            console.error('Error booking ticket:', error);
            botReply("I apologize, but there was an error processing your reservation. Please try again later.");
            setBookingState(prev => ({ ...prev, step: 'initial' }));
          }
        } else if (lowerInput.includes('no')) {
          setBookingState(prev => ({ ...prev, step: 'museum' }));
          botReply("I'm sorry about that. Let's start over. Which museum would you like to visit?");
        } else {
          botReply("I'm sorry, I didn't understand that. Could you please respond with Yes to confirm the booking or No to start over?");
        }
        break;

      case 'alternate_time':
        if (lowerInput.includes('yes')) {
          setBookingState(prev => ({ ...prev, step: 'tickets' }));
          botReply(`Great! How many tickets would you like to book for ${bookingState.timeSlot}?`);
        } else {
          botReply("I understand. Would you like to try a different date? (Yes/No)");
          setBookingState(prev => ({ ...prev, step: 'retry_date' }));
        }
        break;

      case 'retry_date':
        if (lowerInput.includes('yes')) {
          setBookingState(prev => ({ ...prev, step: 'date', date: '', timeSlot: '' }));
          botReply("Alright, let's try a different date. What date would you like to visit? (Please use the format MM/DD/YYYY)");
        } else {
          botReply("I'm sorry we couldn't find a suitable time for your visit. Is there anything else I can help you with?");
          setBookingState(prev => ({ ...prev, step: 'initial', museum: '', date: '', timeSlot: '', tickets: 0 }));
        }
        break;

      default:
        botReply("I'm sorry, I'm not sure how to help with that. Would you like to make a new reservation or ask a question?");
        setBookingState(prev => ({ ...prev, step: 'initial', museum: '', date: '', timeSlot: '', tickets: 0 }));
    }
  };

  const handleAdvancedChatbotQuery = async (query: string) => {
    try {
      const response = await fetch('https://bitrulesapp-0a0366834134.herokuapp.com/items/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ID: bookingState.userId,
          query: query,
        }),
      });
      const data = await response.json();
      botReply(data.response, true);
    } catch (error) {
      console.error('Error fetching response from advanced chatbot:', error);
      botReply("I'm sorry, but I'm having trouble connecting to our advanced system right now. Can I help you with booking a ticket instead?", true);
    }
  };  

  const findNextAvailableSlot = (museum: string, date: string, startTime: string): string | null => {
    const availableSlots = availabilityData
      .filter((entry) => entry.museum.toLowerCase() === museum.toLowerCase() &&
                         entry.date === date &&
                         entry.availableTickets > 0)
      .map((entry) => entry.timeSlot);
    
    const nextAvailableSlot = availableSlots.find((slot) => slot > startTime);
    return nextAvailableSlot || null;
  };
  

  const bookTickets = (userId: string, museum: string, date: string, timeSlot: string, tickets: number): boolean => {
    console.log(`Booking successful for User ID: ${userId}, Museum: ${museum}, Date: ${date}, TimeSlot: ${timeSlot}, Tickets: ${tickets}`);
    return true;  // Simulate successful booking
  };

  const generateTicketDownloadLink = () => {
      // Generate ticket details
      const ticketDetails = `
        Museum: ${bookingState.museum}
        Date: ${bookingState.date}
        Time: ${bookingState.timeSlot}
        Tickets: ${bookingState.tickets}
      `;
  
      const qrCodeData = `${bookingState.museum},${bookingState.date},${bookingState.timeSlot},${bookingState.tickets},${bookingState.userId}`;
  
      const qrCode = (
        <QRCode
          value={qrCodeData}
          size={128} // Adjust the size as needed
          bgColor={"white"}
          fgColor={"black"}
        />
      );
  
      setMessages(prev => [
        ...prev, 
        { component: <pre>{ticketDetails}</pre>, isBot: true },
        { component: qrCode, isBot: true }
      ]);
    };
  
  return (
    <div className="chatbot-container">
      <div className="header">
        <h1>Museum Information and Reservation System</h1>
      </div>
      <div className="chat-area">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.isBot ? (message.isAdvanced ? 'bot advanced' : 'bot') : 'user'}`}>
            {message.text && <p>{message.text}</p>}
            {message.component && message.component}
          </div>
        ))}
        <div ref={messagesEndRef} className="scroll-to-bottom" />
      </div>
      <div className="footer">
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="input-box"
            placeholder="Type your message..."
          />
          <button onClick={handleSend} className="send-button">
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MuseumChatbot;