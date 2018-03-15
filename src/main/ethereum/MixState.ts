import * as Winston from 'winston';
import {Validator} from '../Validator';

export interface IMixState {
  deposit: number;
  deadlineTransferClient: number;
  deadlineProvideWarranty: number;
  deadlineUnblindAddress: number;
  deadlineTransferMixer: number;
  minimumBlockAmount: number;
  numberOfParticipants: number;
  isValid: boolean;
}

export class MixState implements IMixState {
  public deposit: number;
  public deadlineTransferClient: number;
  public deadlineProvideWarranty: number;
  public deadlineUnblindAddress: number;
  public deadlineTransferMixer: number;
  public minimumBlockAmount: number;
  public numberOfParticipants: number;
  public isValid: boolean;

  private static renameMap = {
    0: 'deposit',
    1: 'deadlineTransferClient',
    2: 'deadlineProvideWarranty',
    3: 'deadlineUnblindAddress',
    4: 'deadlineTransferMixer',
    5: 'minimumBlockAmount',
    6: 'numberOfParticipants',
    7: 'isValid',
  };

  private static validate(data: any): IMixState {
    const validator = new Validator<IMixState>(data, [
      Validator.numberValidationRule<IMixState>('deposit'),
      Validator.numberValidationRule<IMixState>('deadlineTransferClient'),
      Validator.numberValidationRule<IMixState>('deadlineProvideWarranty'),
      Validator.numberValidationRule<IMixState>('deadlineUnblindAddress'),
      Validator.numberValidationRule<IMixState>('deadlineTransferMixer'),
      Validator.numberValidationRule<IMixState>('minimumBlockAmount'),
      Validator.numberValidationRule<IMixState>('numberOfParticipants'),
      Validator.booleanValidationRule<IMixState>('isValid'),
    ]);
    return validator.validate();
  }

  public static fromRaw(serializedData: any[]) {
    const data = {};
    for (const key of Object.keys(serializedData)) {
      data[this.renameMap[key]] = serializedData[key];
    }
    return new MixState(this.validate(data));
  }

  private constructor(data: IMixState) {
    for (const key of Object.keys(data)) {
      this[key] = data[key];
    }
  }

}
