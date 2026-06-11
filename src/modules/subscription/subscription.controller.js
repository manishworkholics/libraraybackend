import Plan from "../commonmodel/plan.model.js";
import LibrarySubscription from "../commonmodel/librarySubscription.model.js";
import SubscriptionPayment from "../commonmodel/SubscriptionPayment.model.js";


export const createPlan = async (req, res) => {
  try {
    console.log("REQ BODY => ", req.body);

    const {
      name,
      monthlyPrice,
      quarterlyPrice,
      halfYearlyPrice,
      yearlyPrice,
      maxSeats
    } = req.body;

    if (
      !name ||
      !monthlyPrice ||
      !quarterlyPrice ||
      !halfYearlyPrice ||
      !yearlyPrice ||
      !maxSeats
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields"
      });
    }

    const existingPlan = await Plan.findOne({
      name: name.trim()
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "Plan already exists"
      });
    }

    const plan = new Plan({
      name: name.trim(),
      monthlyPrice: Number(monthlyPrice),
      quarterlyPrice: Number(quarterlyPrice),
      halfYearlyPrice: Number(halfYearlyPrice),
      yearlyPrice: Number(yearlyPrice),
      maxSeats: Number(maxSeats),
      isActive: true
    });

    await plan.save();

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan
    });

  } catch (error) {
    console.log("CREATE PLAN ERROR =>", error);

    return res.status(500).json({
      success: false,
      message: error.message,
      error
    });
  }
};

export const getPlans = async (req, res) => {
  try {

    const plans = await Plan.find({
      isActive: true
    }).sort({
      maxSeats: 1
    });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found"
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updatePlan = async (req, res) => {
  try {

    const {
      name,
      monthlyPrice,
      quarterlyPrice,
      halfYearlyPrice,
      yearlyPrice,
      maxSeats
    } = req.body;

    const existingPlan = await Plan.findOne({
      name: name.trim(),
      _id: { $ne: req.params.id }
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "Plan already exists"
      });
    }

    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        monthlyPrice: Number(monthlyPrice),
        quarterlyPrice: Number(quarterlyPrice),
        halfYearlyPrice: Number(halfYearlyPrice),
        yearlyPrice: Number(yearlyPrice),
        maxSeats: Number(maxSeats)
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      data: plan
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deletePlan = async (req, res) => {
  try {

    const plan = await Plan.findByIdAndDelete(
      req.params.id
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Plan deleted successfully"
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const togglePlanStatus = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found"
      });
    }

    plan.isActive = !plan.isActive;

    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${plan.isActive ? "activated" : "deactivated"
        } successfully`,
      data: plan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getLibrarySubscription = async (
  req,
  res
) => {
  try {
    const { libraryId } = req.params;

    const subscription =
      await LibrarySubscription.findOne({
        libraryId,
        status: "active"
      })
        .populate("planId")
        .populate("libraryId");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found"
      });
    }

    res.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSubscriptionHistory = async (
  req,
  res
) => {
  try {
    const { libraryId } = req.params;

    const subscriptions =
      await LibrarySubscription.find({
        libraryId
      })
        .populate("planId")
        .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const activatePlanForLibrary = async (req, res) => {
  try {
    const {
      libraryId,
      planId,
      durationType,
      paymentMode,
      status = "Success"
    } = req.body;

const plan = await Plan.findById(planId);

if (!plan) {
  return res.status(404).json({
    success: false,
    message: "Plan not found"
  });
}

let amount = 0;
let durationDays = 0;

switch (durationType) {
  case "Monthly":
    amount = plan.monthlyPrice;
    durationDays = 30;
    break;

  case "Quarterly":
    amount = plan.quarterlyPrice;
    durationDays = 90;
    break;

  case "HalfYearly":
    amount = plan.halfYearlyPrice;
    durationDays = 180;
    break;

  case "Yearly":
    amount = plan.yearlyPrice;
    durationDays = 365;
    break;

  default:
    return res.status(400).json({
      success: false,
      message:
        "Duration must be Monthly, Quarterly, HalfYearly or Yearly"
    });
}

// Create Payment Entry
const payment = await SubscriptionPayment.create({
  libraryId,
  planId,
  durationType,
  amount,
  paymentMode,
  status,
  receivedBy: "superAdmin"
});

let subscription = null;

if (status === "Success") {

  const activeSubscription =
    await LibrarySubscription.findOne({
      libraryId,
      status: "active"
    }).sort({ endDate: -1 });

  let startDate = new Date();

  // If already active, extend from existing expiry date
  if (
    activeSubscription &&
    new Date(activeSubscription.endDate) > new Date()
  ) {
    startDate = new Date(
      activeSubscription.endDate
    );
  }

  const endDate = new Date(startDate);

  endDate.setDate(
    endDate.getDate() + durationDays
  );

  // Expire previous active subscriptions
  await LibrarySubscription.updateMany(
    {
      libraryId,
      status: "active"
    },
    {
      status: "expired"
    }
  );

  subscription =
    await LibrarySubscription.create({
      libraryId,
      planId,
      durationType,
      startDate,
      endDate,
      activatedBy: "superadmin",
      status: "active"
    });
}

return res.status(201).json({
  success: true,
  message:
    status === "Success"
      ? "Subscription activated successfully"
      : "Payment added successfully",
  payment,
  subscription
});

  } catch (error) {
    console.error(error);
return res.status(500).json({
  success: false,
  message: error.message
});

  }
};

export const getMySubscription = async (
  req,
  res
) => {
  try {
    const libraryId = req.library._id;

    const subscription =
      await LibrarySubscription.findOne({
        libraryId,
        status: "active"
      }).populate("planId");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription"
      });
    }

    const remainingDays =
      Math.ceil(
        (
          new Date(subscription.endDate) -
          new Date()
        ) /
        (1000 * 60 * 60 * 24)
      );

    res.status(200).json({
      success: true,
      remainingDays,
      data: subscription
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllRenewals = async (req, res) => {
  try {

    const subscriptions =
      await LibrarySubscription.find({
        status: "active"
      })
        .populate("libraryId", "name libraryCode")
        .populate("planId", "name maxSeats")
        .sort({ endDate: 1 });

    const data = subscriptions.map((sub) => {

      const remainingDays = Math.ceil(
        (new Date(sub.endDate) - new Date()) /
        (1000 * 60 * 60 * 24)
      );

      return {
        ...sub.toObject(),
        remainingDays
      };
    });

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getExpiringSoon = async (
  req,
  res
) => {
  try {

    const subscriptions =
      await LibrarySubscription.find({
        status: "active"
      })
        .populate(
          "libraryId",
          "name libraryCode"
        )
        .populate(
          "planId",
          "name maxSeats"
        );

    const expiringSoon =
      subscriptions.filter((sub) => {

        const remainingDays =
          Math.ceil(
            (
              new Date(sub.endDate) -
              new Date()
            ) /
            (1000 * 60 * 60 * 24)
          );

        return remainingDays <= 7;
      });

    res.status(200).json({
      success: true,
      count: expiringSoon.length,
      data: expiringSoon
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const getRenewalDashboard = async (
  req,
  res
) => {
  try {

    const today = new Date();

    const startOfMonth =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

    const activeSubscriptions =
      await LibrarySubscription.countDocuments({
        status: "active",
        endDate: { $gte: today }
      });

    const expiredSubscriptions =
      await LibrarySubscription.countDocuments({
        endDate: { $lt: today }
      });

    const subscriptions =
      await LibrarySubscription.find({
        status: "active"
      });

    const expiringSoon =
      subscriptions.filter((sub) => {

        const remainingDays =
          Math.ceil(
            (
              new Date(sub.endDate) -
              today
            ) /
            (1000 * 60 * 60 * 24)
          );

        return remainingDays <= 7;
      }).length;

    const renewalsThisMonth =
      await SubscriptionPayment.countDocuments({
        status: "Success",
        createdAt: {
          $gte: startOfMonth
        }
      });

    res.status(200).json({
      success: true,

      data: {
        activeSubscriptions,
        expiredSubscriptions,
        expiringSoon,
        renewalsThisMonth
      }
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const getMonthlyRenewalSheet = async (
  req,
  res
) => {
  try {

    const month = Number(req.query.month);
    const year = Number(req.query.year);

    const startDate = new Date(
      year,
      month - 1,
      1
    );

    const endDate = new Date(
      year,
      month,
      0,
      23,
      59,
      59
    );

    const subscriptions =
      await LibrarySubscription.find({
        endDate: {
          $gte: startDate,
          $lte: endDate
        },
        status: "active" // ✅ only active subscriptions
      })
        .populate(
          "libraryId",
          "name libraryCode"
        )
        .populate(
          "planId",
          "name maxSeats"
        )
        .sort({ endDate: 1 }); // ✅ nearest expiry first

    const data = subscriptions.map(
      (sub) => {

        const remainingDays = Math.ceil(
          (
            new Date(sub.endDate) -
            new Date()
          ) /
          (1000 * 60 * 60 * 24)
        );

        return {
          _id: sub._id,

          libraryId:
            sub.libraryId?._id,

          libraryCode:
            sub.libraryId?.libraryCode || "-",

          libraryName:
            sub.libraryId?.name || "-",

          plan:
            sub.planId?.name || "-",

          seats:
            sub.planId?.maxSeats || 0,

          durationType:
            sub.durationType,

          startDate:
            sub.startDate,

          endDate:
            sub.endDate,

          remainingDays,

          status:
            remainingDays <= 0
              ? "expired"
              : remainingDays <= 7
                ? "expiringSoon"
                : "active",

          canRenew:
            remainingDays <= 7
        };
      }
    );

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
