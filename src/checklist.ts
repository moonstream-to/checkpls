export interface BaseStep {
  // String identifying the person who should execute this step.
  executor: string;

  // A string identifying this step. The stepIDs of different steps should be distinct from each other.
  stepID: string;

  // A human-friendly description of this step.
  description?: string;

  // A list of stepIDs of the steps that this step depends on.
  // Each step type has different rules that determine whether it is complete. Check the isStepComplete
  // method to see the criteria.
  dependsOn: string[];
}

export interface InputStep extends BaseStep {
  stepType: "manual";

  // The value that the executor should input.
  value?: any;
}

export interface ViewStep extends BaseStep {
  stepType: "view";

  // The chainID of the chain that the view call should be executed on.
  chainID: string;

  // The address of the contract that the view call should be executed on.
  to: string;

  // The ABI of the method that should be called.
  methodABI: object;

  // The parameters that should be passed to the method. These can be Handlebars.js templates, which will be
  // populated using the execution context created by generateExecutionContext below.
  params: any[];

  // The output of the view call (to be populated once it has been executed).
  output?: any;

  // The block hash at which the view call was executed (to be populated once it has been executed).
  blockHash?: string;
}

export interface RawStep extends BaseStep {
  stepType: "raw";

  // The chainID of the chain that the transaction should be executed on.
  chainID: string;

  // The address of the contract that the transaction should be executed on.
  to: string;

  // The calldata for the transaction.
  calldata: string;

  // The value to be sent with the transaction. These should be denominated in the smallest denomination
  // of the chain's native token. For example, on Ethereum, Wei.
  value?: string;

  // The ABI of the method that should be called. If provided, this is only used for display purposes.
  methodABI?: object;

  // The transaction hash for the transaction (to be populated once it has been executed).
  txHash?: string;

  // true if the transaction was successful, false otherwise (to be populated once it has been executed).
  success?: boolean;
}

export interface MethodCallStep extends BaseStep {
  stepType: "call";

  // The chainID of the chain that the transaction should be executed on.
  chainID: string;

  // The address of the contract that the transaction should be executed on.
  to: string;

  // The ABI of the method that should be called.
  methodABI: object;

  // The parameters that should be passed to the method. These can be Handlebars.js templates, which will be
  // populated using the execution context created by generateExecutionContext below.
  params: any[];

  // The value to be sent with the transaction. These should be denominated in the smallest denomination
  // of the chain's native token. For example, on Ethereum, Wei.
  value?: string;

  // The transaction hash for the transaction (to be populated once it has been executed).
  txHash?: string;

  // true if the transaction was successful, false otherwise (to be populated once it has been executed).
  success?: boolean;

  // The output, if any, of the method call (to be populated once it has been executed).
  output?: any;
}

// Step is the union of all the step types. They can be distinguished using the "stepType" property.
export type Step = InputStep | ViewStep | RawStep | MethodCallStep;

export function isStepComplete(step: Step): boolean {
  switch (step.stepType) {
    case "manual":
      return step.value !== undefined;
    case "view":
      return step.output !== undefined;
    case "raw":
      return step.txHash !== undefined;
    case "call":
      return step.txHash !== undefined;
  }
}

export interface Checklist {
  requester: string;
  description?: string;
  steps: Step[];
  complete?: boolean;
}

export interface StepResult {
  success: boolean;
  value?: any;
}

export function checkStepIDs(checklist: Checklist): boolean {
  let stepIDs: { [k: string]: boolean } = {};

  // Check that stepIDs are unique.
  for (let step of checklist.steps) {
    if (stepIDs[step.stepID]) {
      return false;
    }

    stepIDs[step.stepID] = true;
  }

  // Check that no step depends on steps that don't exist.
  for (let step of checklist.steps) {
    for (let dependencyID of step.dependsOn) {
      if (stepIDs[dependencyID] === undefined) {
        return false;
      }
    }
  }

  return true;
}

export function checkDependencies(checklist: Checklist): boolean {
  // Check that there are no circular dependencies.
  // CONTINUE HERE
  return false;
}

export function nextSteps(checklist: Checklist): Step[] {
  let completeSteps: { [k: string]: Step } = {};
  let incompleteSteps: Step[] = [];
  let nextSteps: Step[] = [];

  for (let step of checklist.steps) {
    if (isStepComplete(step)) {
      completeSteps[step.stepID] = step;
    } else {
      incompleteSteps.push(step);
    }
  }

  for (let step of incompleteSteps) {
    let dependenciesComplete = true;

    for (let dependencyID of step.dependsOn) {
      if (!completeSteps[dependencyID]) {
        dependenciesComplete = false;
        break;
      }
    }

    if (dependenciesComplete) {
      nextSteps.push(step);
    }
  }

  return nextSteps;
}

// Execution context has the form:
// { <stepID>: {success: true | false, output: ... } }
// for stepIDs of completed steps.
export function generateExecutionContext(checklist: Checklist): {
  [k: string]: any;
} {
  let completeSteps = checklist.steps.filter(isStepComplete);
  let context: { [k: string]: StepResult } = {};

  completeSteps.forEach((step) => {
    switch (step.stepType) {
      case "manual":
        context[step.stepID] = { success: true, value: step.value };
        break;
      case "view":
        context[step.stepID] = { success: true, value: step.output };
        break;
      case "raw":
        context[step.stepID] = {
          success: step.success !== undefined ? step.success : false,
          value: step.txHash,
        };
        break;
      case "call":
        context[step.stepID] = {
          success: step.success !== undefined ? step.success : false,
          value: step.output,
        };
        break;
    }
  });

  return context;
}