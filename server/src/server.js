import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

const app = express();
app.use(express.json());

const MONGODB_URI =
  'mongodb+srv://ticket_chatbot:ticket_chatbot@sih24.d2rk6.mongodb.net/?retryWrites=true&w=majority&appName=sih24';

// GET: Check ticket availability
app.get('/api/check-availability', async (req, res) => {
  const { museum, date, timeSlot } = req.query;
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const database = client.db('museum_bookings');
    const availabilityCollection = database.collection('availability');

    const result = await availabilityCollection.findOne({
      museum,
      date,
      timeSlot,
    });
    res.json({ availableTickets: result ? result.availableTickets : 0 });
  } catch (error) {
    console.error('Error checking availability:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  } finally {
    await client.close();
  }
});

// GET: Get the next available time slot
app.get('/api/next-available-slot', async (req, res) => {
  const { museum, date, startTime } = req.query;
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const database = client.db('museum_bookings');
    const availabilityCollection = database.collection('availability');

    const availableSlots = await availabilityCollection
      .find({
        museum,
        date,
        timeSlot: { $gte: startTime },
        availableTickets: { $gt: 0 },
      })
      .sort({ timeSlot: 1 })
      .limit(1)
      .toArray();

    if (availableSlots.length > 0) {
      res.json({ nextAvailableSlot: availableSlots[0].timeSlot });
    } else {
      res.json({ nextAvailableSlot: null });
    }
  } catch (error) {
    console.error('Error finding next available slot:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  } finally {
    await client.close();
  }
});

// POST: Book a ticket
app.post('/api/book-ticket', async (req, res) => {
  const { userId, museum, date, timeSlot, tickets } = req.body;
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const database = client.db('museum_bookings');
    const availabilityCollection = database.collection('availability');
    const ticketCollection = database.collection('tickets');

    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        // Update availability
        const updateResult = await availabilityCollection.updateOne(
          { museum, date, timeSlot, availableTickets: { $gte: tickets } },
          { $inc: { availableTickets: -tickets } },
          { session },
        );

        if (updateResult.modifiedCount === 0) {
          throw new Error('Tickets no longer available');
        }

        // Generate QR code
        const ticketId = new ObjectId().toHexString();
        const qrCodeData = `${ticketId}-${userId}-${museum}-${date}-${timeSlot}-${tickets}`;
        const qrCode = await QRCode.toDataURL(qrCodeData);

        // Create ticket record
        const ticketRecord = {
          _id: new ObjectId(ticketId),
          ticketId,
          userId,
          museum,
          date,
          timeSlot,
          tickets,
          status: 'booked',
          qrCode,
        };

        await ticketCollection.insertOne(ticketRecord, { session });

        res.json({ success: true, ticketId });
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Error booking ticket:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  } finally {
    await client.close();
  }
});

// GET: Download ticket as a PDF
app.get('/api/download-ticket/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const database = client.db('museum_bookings');
    const ticketCollection = database.collection('tickets');

    const ticket = await ticketCollection.findOne({ ticketId });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=museum_ticket_${ticketId}.pdf`,
    );

    doc.pipe(res);

    // Generate PDF content
    doc.fontSize(18).text('Museum Ticket', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Ticket ID: ${ticket.ticketId}`);
    doc.text(`Museum: ${ticket.museum}`);
    doc.text(`Date: ${ticket.date}`);
    doc.text(`Time: ${ticket.timeSlot}`);
    doc.text(`Number of Tickets: ${ticket.tickets}`);
    doc.moveDown();
    doc.image(ticket.qrCode, { width: 150, height: 150, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generating ticket PDF:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  } finally {
    await client.close();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// import express from 'express';
// import QRCode from 'qrcode';
// import PDFDocument from 'pdfkit';

// const app = express();
// app.use(express.json());

// // Hardcoded data
// const availabilityData = [
//   { museum: 'The Louvre', date: '2024-09-15', timeSlot: '10:00', availableTickets: 5 },
//   { museum: 'The Louvre', date: '2024-09-15', timeSlot: '12:00', availableTickets: 0 },
//   { museum: 'The British Museum', date: '2024-09-15', timeSlot: '14:00', availableTickets: 10 },
//   { museum: 'The Metropolitan Museum of Art', date: '2024-09-17', timeSlot: '3:00', availableTickets: 3 },
//   { museum: 'The Metropolitan Museum of Art', date: '2024-09-17', timeSlot: '11:00', availableTickets: 2 },
// ];

// const ticketsData = [];

// // GET: Check ticket availability
// app.get('/api/check-availability', (req, res) => {
//   const { museum, date, timeSlot } = req.query;

//   const result = availabilityData.find(
//     (entry) => entry.museum === museum && entry.date === date && entry.timeSlot === timeSlot
//   );

//   res.json({ availableTickets: result ? result.availableTickets : 0 });
// });

// // GET: Get the next available time slot
// app.get('/api/next-available-slot', (req, res) => {
//   const { museum, date, startTime } = req.query;

//   const availableSlots = availabilityData
//     .filter(
//       (entry) =>
//         entry.museum === museum &&
//         entry.date === date &&
//         entry.timeSlot >= startTime &&
//         entry.availableTickets > 0
//     )
//     .sort((a, b) => (a.timeSlot > b.timeSlot ? 1 : -1));

//   if (availableSlots.length > 0) {
//     res.json({ nextAvailableSlot: availableSlots[0].timeSlot });
//   } else {
//     res.json({ nextAvailableSlot: null });
//   }
// });

// // POST: Book a ticket
// app.post('/api/book-ticket', async (req, res) => {
//   const { userId, museum, date, timeSlot, tickets } = req.body;

//   const availabilityIndex = availabilityData.findIndex(
//     (entry) => entry.museum === museum && entry.date === date && entry.timeSlot === timeSlot
//   );

//   if (availabilityIndex === -1 || availabilityData[availabilityIndex].availableTickets < tickets) {
//     return res.status(400).json({ error: 'Tickets no longer available' });
//   }

//   // Update availability
//   availabilityData[availabilityIndex].availableTickets -= tickets;

//   // Generate QR code
//   const ticketId = `ticket-${Math.floor(Math.random() * 10000)}`;
//   const qrCodeData = `${ticketId}-${userId}-${museum}-${date}-${timeSlot}-${tickets}`;
//   const qrCode = await QRCode.toDataURL(qrCodeData);

//   // Create ticket record
//   const ticketRecord = {
//     ticketId,
//     userId,
//     museum,
//     date,
//     timeSlot,
//     tickets,
//     status: 'booked',
//     qrCode
//   };

//   ticketsData.push(ticketRecord);

//   res.json({ success: true, ticketId });
// });

// // GET: Download ticket as a PDF
// app.get('/api/download-ticket/:ticketId', (req, res) => {
//   const { ticketId } = req.params;

//   const ticket = ticketsData.find((t) => t.ticketId === ticketId);

//   if (!ticket) {
//     return res.status(404).json({ error: 'Ticket not found' });
//   }

//   const doc = new PDFDocument();
//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', `attachment; filename=museum_ticket_${ticketId}.pdf`);

//   doc.pipe(res);

//   // Generate PDF content
//   doc.fontSize(18).text('Museum Ticket', { align: 'center' });
//   doc.moveDown();
//   doc.fontSize(12).text(`Ticket ID: ${ticket.ticketId}`);
//   doc.text(`Museum: ${ticket.museum}`);
//   doc.text(`Date: ${ticket.date}`);
//   doc.text(`Time: ${ticket.timeSlot}`);
//   doc.text(`Number of Tickets: ${ticket.tickets}`);
//   doc.moveDown();
//   doc.image(ticket.qrCode, { width: 150, height: 150, align: 'center' });

//   doc.end();
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
