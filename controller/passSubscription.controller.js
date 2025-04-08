import { PassSubscription } from '../models/passSubscription.model.js';
import { CommunityMember } from '../models/communitymembers.model.js';
import mongoose from 'mongoose';

export const getUserPassSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const subscriptions = await PassSubscription.aggregate([
      {
        $match: {
          userId: userObjectId
        }
      },
      {
        $lookup: {
          from: 'communities',
          localField: 'communityId',
          foreignField: '_id',
          as: 'community'
        }
      },
      {
        $unwind: {
          path: '$community',
          preserveNullAndEmptyArrays: true
        }
      },
      // Get community creator details
      {
        $lookup: {
          from: 'artists',
          localField: 'community.createdBy',
          foreignField: '_id',
          as: 'creator'
        }
      },
      {
        $unwind: {
          path: '$creator',
          preserveNullAndEmptyArrays: true
        }
      },
      // Get community members with their details
      {
        $lookup: {
          from: 'communitymembers',
          let: { communityId: '$communityId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$communityId', '$$communityId'] }
              }
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails'
              }
            },
            {
              $unwind: '$userDetails'
            },
            {
              $project: {
                _id: 0,
                userId: 1,
                joinDate: 1,
                username: '$userDetails.username',
                profileImage: '$userDetails.profileImage'
              }
            }
          ],
          as: 'members'
        }
      },
      {
        $addFields: {
          memberCount: { $size: '$members' }
        }
      },
      {
        $project: {
          communityName: '$community.communityName',
          communityImage: '$community.coverImage',
          communityDescription: '$community.description',
          status: 1,
          expiryDate: 1,
          memberCount: 1,
          startDate: 1,
          renewalPrice: 1,
          currency: 1,
          collectibelType: 1,
          creator: {
            name: '$creator.name',
            profileImage: '$creator.profileImage',
            verified: '$creator.verified'
          },
          members: {
            $slice: ['$members', 5] // Get first 5 members
          },
          tribePass: {
            collectibleName: '$community.tribePass.collectibleName',
            collectibleDescription: '$community.tribePass.collectibleDescription',
            collectibleImage: '$community.tribePass.collectibleImage',
            collectibleType: '$community.tribePass.collectibleType'
          }
        }
      }
    ]);

    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub._id,
      name: sub.communityName || 'Unknown Community',
      description: sub.communityDescription,
      image: sub.communityImage,
      memberCount: sub.memberCount || 0,
      status: sub.status === 'active' ? 'Active member' : 'Inactive',
      expiry: sub.expiryDate ? `Till: ${new Date(sub.expiryDate).toLocaleDateString()}` : 'Due for renewal',
      creator: sub.creator,
      members: sub.members,
      tribePass: {
        ...sub.tribePass,
        price: `${sub.renewalPrice} ${sub.currency}`,
        type: sub.collectibelType
      }
    }));

    return res.status(200).json({
      success: true,
      data: formattedSubscriptions
    });

  } catch (error) {
    console.error('Error fetching pass subscriptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pass subscriptions',
      error: error.message
    });
  }
};
