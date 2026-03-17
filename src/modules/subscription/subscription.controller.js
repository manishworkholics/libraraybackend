import LibrarySubscription from "./librarySubscription.model.js";
import Plan from "../commonmodel/plan.model.js";

export const activatePlanForLibrary = async (req, res) => {
  try {
    const { libraryId, planId } = req.body;

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const startDate = new Date();
    const endDate = new Date();

    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = await LibrarySubscription.create({
      libraryId,
      planId,
      startDate,
      endDate,
      activatedBy: "superadmin",
    });

    res.json({
      success: true,
      message: "Plan activated for library",
      data: subscription,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




// create plan
export const createPlan = async (req, res) => {
  try {
    const plan = await Plan.create(req.body);

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get all plans
export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// update plan
export const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({
      success: true,
      message: "Plan updated",
      data: plan,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// delete plan
export const deletePlan = async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Plan deleted",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};