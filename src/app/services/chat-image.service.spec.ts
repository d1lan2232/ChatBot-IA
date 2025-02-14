import { TestBed } from '@angular/core/testing';

import { ChatImageService } from './chat-image.service';

describe('ChatImageService', () => {
  let service: ChatImageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatImageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
