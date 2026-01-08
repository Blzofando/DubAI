
import { createHash } from 'crypto';

export function getSecMSGECToken(): string {
    const ticks = Date.now() * 10000 + 116444736000000000;
    const roundedTicks = Math.floor(ticks / 3000000000) * 3000000000;
    const strToHash = roundedTicks.toString() + '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
    return createHash('sha256').update(strToHash).digest('hex').toUpperCase();
}
