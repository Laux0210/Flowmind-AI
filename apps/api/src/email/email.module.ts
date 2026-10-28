import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { SimulatedEmailProvider } from './simulated-email.provider';

@Module({
  providers: [
    SimulatedEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useClass: SimulatedEmailProvider,
    },
  ],
  exports: [EMAIL_PROVIDER, SimulatedEmailProvider],
})
export class EmailModule {}
