// DetectionResults の表（キー photoId）への読み書きの試験
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createSpeciesDetectionRepository, type DetectionResultRecord } from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createSpeciesDetectionRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'DetectionResults',
);

const detected: DetectionResultRecord = {
  detectionId: 'det-1',
  photoId: 'photo-1',
  outcome: 'detected',
  species: 'boar',
  confidence: 92,
  rawLabels: [{ name: 'Boar', confidence: 92 }],
  detectedAt: '2026-11-23T03:00:00.000Z',
  expiresAt: 1234567890,
};

beforeEach(() => ddbMock.reset());

describe('createSpeciesDetectionRepository', () => {
  it('結果を作る（put）', async () => {
    ddbMock.on(PutCommand).resolves({});
    await repo.put(detected);
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
      TableName: 'DetectionResults',
      Item: detected,
    });
  });

  it('photoId で結果を読む（getByPhotoId）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: detected });
    await expect(repo.getByPhotoId('photo-1')).resolves.toEqual(detected);
    expect(ddbMock.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
      TableName: 'DetectionResults',
      Key: { photoId: 'photo-1' },
    });
  });

  it('結果がなければ undefined', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(repo.getByPhotoId('photo-x')).resolves.toBeUndefined();
  });
});
