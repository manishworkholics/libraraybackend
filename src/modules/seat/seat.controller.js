import SeatBooking from "../commonmodel/seatBooking.model.js";
import Seat from "./seat.model.js";
import Student from "../student/student.model.js";


export const createSeat = async (req, res) => {
  try {
    const { seatNumber, floor } = req.body;
    const { libraryId, role } = req.user;

    // 🔒 Only owner or staff can create seats
    if (!["owner", "staff"].includes(role)) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    // 🔎 Check duplicate seat in same library
    const existingSeat = await Seat.findOne({
      seatNumber,
      libraryId
    });

    if (existingSeat) {
      return res.status(400).json({
        message: "Seat already exists in this library"
      });
    }

    // 🪑 Create seat
    const seat = await Seat.create({
      seatNumber,
      floor,
      libraryId
    });

    res.status(201).json({
      message: "Seat created successfully",
      seat
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const allotSeatToStudent = async (req, res) => {
  try {

    const { seatId, studentId, shift } = req.body;

    const { libraryId } = req.user;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const studyHours =
      student.studyHours ||
      student.planHours ||
      12;

    // 🔥 FULL RESERVED VALIDATION
    if (
      shift === "Full Day" &&
      studyHours !== "Full Day"
    ) {
      return res.status(400).json({
        message:
          "Only full day plan students can reserve seat"
      });
    }

    // 🔥 PARTIAL EXPIRE TIME
    let expiryTime = null;

    if (shift === "partial") {

      expiryTime = new Date(
        Date.now() +
        studyHours * 60 * 60 * 1000
      );
    }

    // 1️⃣ Check seat belongs to library
    const seat = await Seat.findOne({
      _id: seatId,
      libraryId
    });

    if (!seat) {
      return res.status(404).json({
        message:
          "Seat not found in your library"
      });
    }

    // 2️⃣ Auto expire old occupied seats
    await SeatBooking.updateMany(
      {
        status: "active",
        shift: "partial",
        expiryTime: {
          $lte: new Date()
        }
      },
      {
        $set: {
          status: "expired"
        }
      }
    );

    // 3️⃣ Student already active?
    const existingStudentBooking =
      await SeatBooking.findOne({
        studentId,
        status: "active"
      });

    if (existingStudentBooking) {
      return res.status(400).json({
        message:
          "Student already has active seat"
      });
    }

    // 4️⃣ Existing seat bookings
    const seatBookings =
      await SeatBooking.find({
        seatId,
        status: "active"
      });

    const hasReserved =
      seatBookings.find(
        b => b.shift === "Full Day"
      );

    const hasOccupied =
      seatBookings.find(
        b => b.shift === "partial"
      );

    // 🔴 Reserved already exists
    if (hasReserved) {
      return res.status(400).json({
        message:
          "Seat already reserved"
      });
    }

    // 🔴 Cannot reserve occupied seat
    if (
      shift === "Full Day" &&
      hasOccupied
    ) {
      return res.status(400).json({
        message:
          "Seat already occupied"
      });
    }

    // 🔴 Cannot occupy reserved seat
    if (
      shift === "partial" &&
      hasReserved
    ) {
      return res.status(400).json({
        message:
          "Seat already reserved"
      });
    }

    // 5️⃣ Create booking
    const booking =
      await SeatBooking.create({
        seatId,
        studentId,
        libraryId,
        shift,
        expiryTime,
        status: "active"
      });

    res.status(201).json({
      message:
        "Seat allotted successfully",
      booking
    });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Seat already booked"
      });
    }

    res.status(500).json({
      message: error.message
    });
  }
};

export const getSeatStatus = async (req, res) => {
  try {

    const { libraryId } = req.user;

    // 🔥 AUTO EXPIRE OCCUPIED BOOKINGS
    await SeatBooking.updateMany(
      {
        status: "active",
        shift: "partial",
        expiryTime: {
          $lte: new Date()
        }
      },
      {
        $set: {
          status: "expired"
        }
      }
    );

    // 1️⃣ Get all seats
    const seats = await Seat.find({
      libraryId
    });

    const result = [];

    for (let seat of seats) {

      // 2️⃣ Active bookings
      const bookings =
        await SeatBooking.find({
          seatId: seat._id,
          status: "active"
        }).populate(
          "studentId",
          "name studyHours"
        );

      let status = "vacant";

      // 🔥 RESERVED
      const hasReserved =
        bookings.find(
          b => b.shift === "Full Day"
        );

      // 🔥 OCCUPIED
      const hasOccupied =
        bookings.find(
          b => b.shift === "partial"
        );

      // 🔥 STATUS LOGIC
      if (hasReserved) {
        status = "reserved";
      }
      else if (hasOccupied) {
        status = "occupied";
      }

      result.push({
        seatId: seat._id,
        seatNumber: seat.seatNumber,
        floor: seat.floor,
        status,

        studentName:
          bookings[0]?.studentId?.name || "",

        studyHours:
          bookings[0]?.studentId?.studyHours || "",

        shift:
          bookings[0]?.shift || "",

        expiryTime:
          bookings[0]?.expiryTime || null
      });
    }

    res.json(result);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });
  }
};

export const bookSeat = async (req, res) => {
  try {
    const { seatId, shift = "fullDay" } = req.body;
    const { userId: studentId, libraryId } = req.user;

    // 1️⃣ Check seat belongs to this library
    const seat = await Seat.findOne({
      _id: seatId,
      libraryId
    });

    if (!seat) {
      return res.status(404).json({
        message: "Seat not found in your library"
      });
    }

    // 2️⃣ Check if student already has active seat
    const existingStudentBooking = await SeatBooking.findOne({
      studentId,
      status: "active"
    });

    if (existingStudentBooking) {
      return res.status(400).json({
        message: "You already have an active seat"
      });
    }

    // 3️⃣ Check seat active bookings
    const seatBookings = await SeatBooking.find({
      seatId,
      status: "active"
    });

    const hasFullDay = seatBookings.find(b => b.shift === "fullDay");
    const hasMorning = seatBookings.find(b => b.shift === "morning");
    const hasEvening = seatBookings.find(b => b.shift === "evening");

    // 🔴 Full day already booked
    if (hasFullDay) {
      return res.status(400).json({
        message: "Seat already fully occupied"
      });
    }

    // 🔴 Conflict logic
    if (shift === "fullDay" && (hasMorning || hasEvening)) {
      return res.status(400).json({
        message: "Seat partially occupied, cannot book full day"
      });
    }

    if (shift === "morning" && hasMorning) {
      return res.status(400).json({
        message: "Morning shift already booked"
      });
    }

    if (shift === "evening" && hasEvening) {
      return res.status(400).json({
        message: "Evening shift already booked"
      });
    }

    // 4️⃣ Create booking
    const booking = await SeatBooking.create({
      seatId,
      studentId,
      libraryId,
      shift
    });

    res.status(201).json({
      message: "Seat booked successfully",
      booking
    });

  } catch (error) {

    // MongoDB unique index protection
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Seat already booked"
      });
    }

    res.status(500).json({ message: error.message });
  }
};

export const cancelSeatBooking = async (req, res) => {
  try {
    const { userId: studentId } = req.user;

    const booking = await SeatBooking.findOne({
      studentId,
      status: "active"
    });

    if (!booking) {
      return res.status(404).json({
        message: "No active seat booking found"
      });
    }

    booking.status = "cancelled";
    await booking.save();

    res.json({
      message: "Seat booking cancelled successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMySeat = async (req, res) => {
  try {
    const { userId: studentId } = req.user;

    const booking = await SeatBooking.findOne({
      studentId,
      status: "active"
    }).populate("seatId");

    if (!booking) {
      return res.json({
        message: "No active seat booked",
        seat: null
      });
    }

    res.json({
      seat: {
        seatNumber: booking.seatId.seatNumber,
        floor: booking.seatId.floor,
        shift: booking.shift,
        bookedAt: booking.createdAt
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSeatDashboardSummary =
  async (req, res) => {

    try {

      const { libraryId } =
        req.user;

      const seats =
        await Seat.find({
          libraryId
        });

      let vacant = 0;

      let partial = 0;

      let full = 0;

      for (let seat of seats) {

        const bookings =
          await SeatBooking.find({

            seatId: seat._id,

            status: "active"

          });

        // ✅ RESERVED
        const hasReserved =
          bookings.find(
            b =>
              b.shift === "Full Day"
          );

        // ✅ OCCUPIED
        const hasOccupied =
          bookings.find(
            b =>
              b.shift === "partial"
          );

        // ✅ SUMMARY
        if (hasReserved) {

          full++;

        }
        else if (hasOccupied) {

          partial++;

        }
        else {

          vacant++;

        }

      }

      res.json({

        totalSeats:
          seats.length,

        vacant,

        partial,

        full

      });

    } catch (error) {

      res.status(500).json({

        message:
          error.message

      });

    }

  };