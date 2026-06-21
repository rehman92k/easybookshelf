import { PartialType } from '@nestjs/swagger';
import { CreatePublisherBookDto } from './create-publisher-book.dto';

export class UpdatePublisherBookDto extends PartialType(CreatePublisherBookDto) {}
