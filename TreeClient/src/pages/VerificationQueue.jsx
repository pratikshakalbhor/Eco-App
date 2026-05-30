import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Check, X, Eye, ShieldCheck, TreePine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { verifyTreeOnChain } from '../utils/web3Service';

export default function VerificationQueue() {
  const queryClient = useQueryClient();

  const { data: pendingTrees = [], isLoading } = useQuery({
    queryKey: ['pending-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/pending`);
      return data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, blockchainId }) => {
      // 1. If approved, verify on blockchain first
      if (status === 'approved') {
        await verifyTreeOnChain(blockchainId);
      }
      
      // 2. Update backend status
      await axios.post(`${import.meta.env.VITE_API_URL}/api/trees/${id}/verify`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-trees']);
      alert("Tree verification status updated!");
    },
    onError: (err) => {
        console.error(err);
        alert("Verification failed: " + err.message);
    }
  });

  if (isLoading) return <div className="p-10 text-center">Loading verification queue...</div>;

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-10 h-10 text-emerald-600" />
        <h1 className="text-3xl font-bold text-gray-900">Verification Queue</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Photo</TableHead>
              <TableHead>Species</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Planted Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingTrees.map((tree) => (
              <TableRow key={tree.id}>
                <TableCell>
                  <img src={tree.photo_url} alt="Tree" className="w-12 h-12 rounded-lg object-cover" />
                </TableCell>
                <TableCell className="font-semibold">{tree.species}</TableCell>
                <TableCell>{tree.location_name}</TableCell>
                <TableCell>{new Date(tree.planted_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => verifyMutation.mutate({ id: tree.id, status: 'approved', blockchainId: tree.blockchain_token_id })}
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => verifyMutation.mutate({ id: tree.id, status: 'rejected' })}
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {pendingTrees.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-gray-500">
                  <TreePine className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  No pending verifications
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
